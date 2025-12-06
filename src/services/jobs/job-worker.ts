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

// 設定値
const SEMANTIC_DIFF_THRESHOLD = 0.05; // 5%以上変化したときだけ履歴を切る
const RELATION_SIMILAR_THRESHOLD = 0.85; // similar判定の閾値
const RELATION_DERIVED_THRESHOLD = 0.92; // derived判定の閾値
const RELATION_LIMIT = 10; // 1ノートあたりの最大relation数

/**
 * NOTE_ANALYZE ジョブのメイン処理
 *
 * 1. Embedding生成・保存
 * 2. Semantic Diff計算（previousContentがある場合）
 * 3. 履歴保存（diffがしきい値以上の場合のみ）
 * 4. Relation Graph再構築
 */
export const handleNoteAnalyzeJob = async (payload: NoteAnalyzePayload) => {
  const { noteId, previousContent, updatedAt } = payload;

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

  if (previousContent) {
    const beforeEmb = await generateEmbedding(previousContent);
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
  if (shouldSaveHistory && previousContent) {
    const textDiff = computeDiff(previousContent, note.content);
    await insertHistory({
      id: randomUUID(),
      noteId,
      content: previousContent,
      diff: textDiff,
      semanticDiff: semanticDiff !== null ? String(semanticDiff) : null,
      createdAt: Math.floor(Date.now() / 1000),
    });
    logger.debug({ noteId, semanticDiff }, "[JobWorker] History saved");
  }

  // 4. Relation Graph再構築
  // 新規ノート or 意味的変化があった場合のみ
  const shouldRebuildRelations = !previousContent || (semanticDiff !== null && semanticDiff >= SEMANTIC_DIFF_THRESHOLD);

  if (shouldRebuildRelations) {
    await rebuildRelationsForNote(noteId, embedding);
    logger.debug({ noteId }, "[JobWorker] Relations rebuilt");
  }
};

/**
 * ノートのRelationを再構築
 */
const rebuildRelationsForNote = async (
  noteId: string,
  currentEmb: number[]
) => {
  // 他の全ノートのEmbeddingを取得
  const allEmbeddings = await getAllEmbeddings();

  // 類似度を計算してフィルタ
  const candidates: Array<{
    targetNoteId: string;
    relationType: RelationType;
    score: number;
  }> = [];

  for (const { noteId: otherId, embedding } of allEmbeddings) {
    // 自分自身は除外
    if (otherId === noteId) continue;

    const sim = cosineSimilarity(currentEmb, embedding);

    // しきい値以上のものだけ
    if (sim >= RELATION_SIMILAR_THRESHOLD) {
      const relationType: RelationType =
        sim >= RELATION_DERIVED_THRESHOLD ? "derived" : "similar";

      candidates.push({
        targetNoteId: otherId,
        relationType,
        score: sim,
      });
    }
  }

  // スコア降順でソートして上位N件に絞る
  const topRelations = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, RELATION_LIMIT);

  // 既存のRelationを削除
  await deleteRelationsBySourceNote(noteId);

  // 新しいRelationを作成
  if (topRelations.length > 0) {
    await createRelations(
      topRelations.map((r) => ({
        sourceNoteId: noteId,
        targetNoteId: r.targetNoteId,
        relationType: r.relationType,
        score: r.score,
      }))
    );
  }
};
