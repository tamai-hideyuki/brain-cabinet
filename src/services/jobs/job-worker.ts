import { findNoteById } from "../../repositories/notesRepo";
import { insertHistory } from "../../repositories/historyRepo";
import {
  deleteRelationsBySourceNote,
  createRelations,
} from "../../repositories/relationRepo";
import { getAllEmbeddings, saveEmbedding } from "../../repositories/embeddingRepo";
import {
  generateEmbedding,
  cosineSimilarity,
  semanticChangeScore,
} from "../embeddingService";
import { computeDiff } from "../../utils/diff";
import { logger } from "../../utils/logger";
import { randomUUID } from "crypto";
import type { NoteAnalyzePayload } from "./job-queue";
import type { RelationType } from "../../db/schema";
import { generateInfluenceEdges } from "../influence/influenceService";
import {
  analyzeSemanticChange,
  serializeChangeDetail,
} from "../semanticChange";

// 設定値
const SEMANTIC_DIFF_THRESHOLD = 0.05; // 5%以上変化したときだけ履歴を切る
const RELATION_SIMILAR_THRESHOLD = 0.85; // similar判定の閾値
const RELATION_DERIVED_THRESHOLD = 0.92; // derived判定の閾値
const RELATION_LIMIT = 10; // 1ノートあたりの最大relation数

// Cluster boost 設定値
const CLUSTER_BOOST_SAME = 0.10;  // 同一クラスタなら +0.10
const CLUSTER_PENALTY_DIFF = 0.05; // 異なるクラスタなら -0.05

/**
 * NOTE_ANALYZE ジョブのメイン処理
 *
 * 1. Embedding生成・保存
 * 2. Semantic Diff計算（previousContentがある場合）
 * 3. 履歴保存（diffがしきい値以上の場合のみ）
 * 4. Relation Graph再構築
 */
export const handleNoteAnalyzeJob = async (payload: NoteAnalyzePayload) => {
  const { noteId, previousContent, previousClusterId, updatedAt } = payload;

  // ノート取得
  const note = await findNoteById(noteId);
  if (!note) {
    logger.warn({ noteId }, "[JobWorker] Note not found, skipping");
    return;
  }

  // ジョブ順序チェック：ノートのupdatedAtとジョブのupdatedAtを比較
  // ノートが更新されていたら（より新しいジョブが処理済み）スキップ
  if (note.updatedAt > updatedAt) {
    logger.debug(
      { noteId, noteUpdatedAt: note.updatedAt, jobUpdatedAt: updatedAt },
      "[JobWorker] Outdated job, skipping"
    );
    return;
  }

  // 1. Embedding生成
  const text = `${note.title}\n\n${note.content}`;
  const embedding = await generateEmbedding(text);

  // Embedding保存
  await saveEmbedding(noteId, embedding);
  logger.debug({ noteId }, "[JobWorker] Embedding saved");

  // 2. Semantic Diff計算（更新時のみ）
  let semanticDiff: number | null = null;
  let shouldSaveHistory = false;
  let beforeEmb: number[] | null = null;

  if (previousContent) {
    beforeEmb = await generateEmbedding(previousContent);
    semanticDiff = semanticChangeScore(beforeEmb, embedding);

    logger.debug(
      { noteId, semanticDiff },
      "[JobWorker] Semantic diff calculated"
    );

    // diffがしきい値以上なら履歴を保存
    if (semanticDiff >= SEMANTIC_DIFF_THRESHOLD) {
      shouldSaveHistory = true;
    }
  }

  // 3. 履歴保存（意味的に大きな変化があった場合のみ）
  if (shouldSaveHistory && previousContent && beforeEmb) {
    const textDiff = computeDiff(previousContent, note.content);
    const newClusterId = note.clusterId ?? null;

    // v5.6: セマンティック変化を分析
    const changeDetail = analyzeSemanticChange(
      previousContent,
      note.content,
      beforeEmb,
      embedding,
      semanticDiff ?? undefined
    );

    await insertHistory({
      id: randomUUID(),
      noteId,
      content: previousContent,
      diff: textDiff,
      semanticDiff: semanticDiff !== null ? String(semanticDiff) : null,
      prevClusterId: previousClusterId ?? null,  // v3: クラスタ遷移追跡
      newClusterId,                               // v3: 現在のクラスタID
      changeType: changeDetail.type,              // v5.6: 変化タイプ
      changeDetail: serializeChangeDetail(changeDetail, false),  // v5.6: 詳細（方向ベクトル除く）
      createdAt: Math.floor(Date.now() / 1000),
    });
    logger.debug(
      {
        noteId,
        semanticDiff,
        changeType: changeDetail.type,
        prevClusterId: previousClusterId,
        newClusterId,
      },
      "[JobWorker] History saved with semantic change detail"
    );
  }

  // 4. Relation Graph再構築
  // 新規ノート or 意味的変化があった場合のみ
  const shouldRebuildRelations = !previousContent || (semanticDiff !== null && semanticDiff >= SEMANTIC_DIFF_THRESHOLD);

  if (shouldRebuildRelations) {
    await rebuildRelationsForNote(noteId, embedding);
    logger.debug({ noteId }, "[JobWorker] Relations rebuilt");
  }

  // 5. Concept Influence Graph 更新（ドリフトがあった場合）
  if (semanticDiff !== null && semanticDiff >= SEMANTIC_DIFF_THRESHOLD) {
    const newClusterId = note.clusterId ?? null;
    const edgesCreated = await generateInfluenceEdges(
      noteId,
      semanticDiff,
      previousClusterId ?? null,
      newClusterId
    );
    if (edgesCreated > 0) {
      logger.debug(
        { noteId, edgesCreated, semanticDiff },
        "[JobWorker] Influence edges generated"
      );
    }
  }
};

/**
 * ノートのRelationを再構築
 * cluster_boostを適用：同一クラスタは+0.10、異なるクラスタは-0.05
 */
const rebuildRelationsForNote = async (
  noteId: string,
  currentEmb: number[]
) => {
  // ソースノートのcluster_idを取得
  const sourceNote = await findNoteById(noteId);
  const sourceClusterId = sourceNote?.clusterId ?? null;

  // 他の全ノートのEmbeddingを取得
  const allEmbeddings = await getAllEmbeddings();

  // 全ノートのcluster_idを取得（バッチ処理のため）
  const noteClusterMap = new Map<string, number | null>();
  for (const { noteId: otherId } of allEmbeddings) {
    if (otherId !== noteId) {
      const otherNote = await findNoteById(otherId);
      noteClusterMap.set(otherId, otherNote?.clusterId ?? null);
    }
  }

  // 類似度を計算してフィルタ
  const candidates: Array<{
    targetNoteId: string;
    relationType: RelationType;
    score: number;
    boostedScore: number;
  }> = [];

  for (const { noteId: otherId, embedding } of allEmbeddings) {
    // 自分自身は除外
    if (otherId === noteId) continue;

    const sim = cosineSimilarity(currentEmb, embedding);

    // cluster_boostを適用
    const targetClusterId = noteClusterMap.get(otherId) ?? null;
    let boost = 0;
    if (sourceClusterId !== null && targetClusterId !== null) {
      if (sourceClusterId === targetClusterId) {
        boost = CLUSTER_BOOST_SAME; // +0.10
      } else {
        boost = -CLUSTER_PENALTY_DIFF; // -0.05
      }
    }
    const boostedScore = Math.min(1.0, Math.max(0, sim + boost));

    // しきい値判定はブースト後のスコアで行う
    if (boostedScore >= RELATION_SIMILAR_THRESHOLD) {
      const relationType: RelationType =
        boostedScore >= RELATION_DERIVED_THRESHOLD ? "derived" : "similar";

      candidates.push({
        targetNoteId: otherId,
        relationType,
        score: sim, // 元のスコアも保持
        boostedScore,
      });
    }
  }

  // ブースト後スコア降順でソートして上位N件に絞る
  const topRelations = candidates
    .sort((a, b) => b.boostedScore - a.boostedScore)
    .slice(0, RELATION_LIMIT);

  // 既存のRelationを削除
  await deleteRelationsBySourceNote(noteId);

  // 新しいRelationを作成（保存するのはブースト後のスコア）
  if (topRelations.length > 0) {
    await createRelations(
      topRelations.map((r) => ({
        sourceNoteId: noteId,
        targetNoteId: r.targetNoteId,
        relationType: r.relationType,
        score: r.boostedScore,
      }))
    );

    logger.debug(
      { noteId, sourceClusterId, relationCount: topRelations.length },
      "[JobWorker] Relations created with cluster boost"
    );
  }
};
