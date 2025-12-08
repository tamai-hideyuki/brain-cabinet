/**
 * Concept Influence Service（C モデル：Drift 連動）
 *
 * ノート更新時に影響エッジをリアルタイム生成
 *
 * 式: influence(A → B) = cosine(A, B) × drift_score(B)
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { computeDriftScore } from "../drift/computeDriftScore";
import { getAllEmbeddings, getEmbedding } from "../../repositories/embeddingRepo";

const INFLUENCE_THRESHOLD = 0.15;

/**
 * コサイン類似度を計算（L2 正規化済みなので dot product）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export type InfluenceEdge = {
  sourceNoteId: string;
  targetNoteId: string;
  weight: number;
  cosineSim: number;
  driftScore: number;
};

/**
 * ドリフトしたノートに対して影響エッジを生成
 *
 * @param targetNoteId - ドリフトしたノート（B）
 * @param semanticDiff - 意味的差分スコア
 * @param prevClusterId - 変更前のクラスタID
 * @param newClusterId - 変更後のクラスタID
 */
export async function generateInfluenceEdges(
  targetNoteId: string,
  semanticDiff: number,
  prevClusterId: number | null,
  newClusterId: number | null
): Promise<number> {
  // 1. ターゲットノートの embedding を取得
  const targetEmbedding = await getEmbedding(targetNoteId);
  if (!targetEmbedding) {
    return 0;
  }

  // 2. Drift Score を計算
  const { driftScore } = computeDriftScore({
    semanticDiff,
    oldClusterId: prevClusterId,
    newClusterId,
  });

  // しきい値未満のドリフトはスキップ
  if (driftScore < 0.1) {
    return 0;
  }

  // 3. 全ノートの embedding を取得
  const allEmbeddings = await getAllEmbeddings();

  // 4. 各ソースノートとの影響度を計算
  const now = Math.floor(Date.now() / 1000);
  let edgesCreated = 0;

  for (const { noteId: sourceNoteId, embedding: sourceEmbedding } of allEmbeddings) {
    // 自己参照はスキップ
    if (sourceNoteId === targetNoteId) continue;

    // コサイン類似度を計算
    const cosineSim = cosineSimilarity(sourceEmbedding, targetEmbedding);

    // influence(A → B) = cosine(A, B) × drift_score(B)
    const weight = round4(cosineSim * driftScore);

    // しきい値以下はスキップ
    if (weight < INFLUENCE_THRESHOLD) continue;

    // エッジを挿入/更新
    await db.run(sql`
      INSERT INTO note_influence_edges
        (source_note_id, target_note_id, weight, cosine_sim, drift_score, created_at)
      VALUES
        (${sourceNoteId}, ${targetNoteId}, ${weight}, ${round4(cosineSim)}, ${round4(driftScore)}, ${now})
      ON CONFLICT(source_note_id, target_note_id) DO UPDATE SET
        weight = excluded.weight,
        cosine_sim = excluded.cosine_sim,
        drift_score = excluded.drift_score,
        created_at = excluded.created_at
    `);

    edgesCreated++;
  }

  return edgesCreated;
}

/**
 * ノートが削除されたとき、関連するエッジを削除
 */
export async function removeInfluenceEdges(noteId: string): Promise<void> {
  await db.run(sql`
    DELETE FROM note_influence_edges
    WHERE source_note_id = ${noteId} OR target_note_id = ${noteId}
  `);
}

/**
 * 特定ノートに影響を与えているノート一覧を取得
 */
export async function getInfluencersOf(
  noteId: string,
  limit: number = 10
): Promise<InfluenceEdge[]> {
  const rows = await db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
  }>(sql`
    SELECT source_note_id, target_note_id, weight, cosine_sim, drift_score
    FROM note_influence_edges
    WHERE target_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
  }));
}

/**
 * 特定ノートが影響を与えているノート一覧を取得
 */
export async function getInfluencedBy(
  noteId: string,
  limit: number = 10
): Promise<InfluenceEdge[]> {
  const rows = await db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
  }>(sql`
    SELECT source_note_id, target_note_id, weight, cosine_sim, drift_score
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
  }));
}

/**
 * Influence Graph を再構築
 *
 * note_history から drift イベントを持つ履歴を取得し、
 * 影響エッジを再生成する
 */
export async function rebuildInfluenceGraph(): Promise<{
  cleared: number;
  edgesCreated: number;
  notesProcessed: number;
}> {
  // 既存のエッジを削除
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM note_influence_edges
  `);
  const cleared = existingCount[0]?.count || 0;

  await db.run(sql`DELETE FROM note_influence_edges`);

  // note_history から semantic_diff がある履歴を取得
  const historyRows = await db.all<{
    note_id: string;
    semantic_diff: string | null;
    prev_cluster_id: number | null;
    new_cluster_id: number | null;
  }>(sql`
    SELECT note_id, semantic_diff, prev_cluster_id, new_cluster_id
    FROM note_history
    WHERE semantic_diff IS NOT NULL
    ORDER BY created_at ASC
  `);

  let edgesCreated = 0;
  const processedNotes = new Set<string>();

  for (const row of historyRows) {
    if (!row.semantic_diff) continue;

    const semanticDiff = parseFloat(row.semantic_diff);
    if (isNaN(semanticDiff)) continue;

    const edges = await generateInfluenceEdges(
      row.note_id,
      semanticDiff,
      row.prev_cluster_id,
      row.new_cluster_id
    );

    edgesCreated += edges;
    processedNotes.add(row.note_id);
  }

  return {
    cleared,
    edgesCreated,
    notesProcessed: processedNotes.size,
  };
}

/**
 * グラフ全体の統計を取得
 */
export async function getInfluenceStats(): Promise<{
  totalEdges: number;
  avgWeight: number;
  maxWeight: number;
  topInfluencedNotes: Array<{
    noteId: string;
    edgeCount: number;
    totalInfluence: number;
  }>;
  topInfluencers: Array<{
    noteId: string;
    edgeCount: number;
    totalInfluence: number;
  }>;
}> {
  // 基本統計
  const basicStats = await db.all<{
    total_edges: number;
    avg_weight: number;
    max_weight: number;
  }>(sql`
    SELECT
      COUNT(*) as total_edges,
      AVG(weight) as avg_weight,
      MAX(weight) as max_weight
    FROM note_influence_edges
  `);

  // 最も影響を受けたノート
  const topInfluenced = await db.all<{
    target_note_id: string;
    edge_count: number;
    total_influence: number;
  }>(sql`
    SELECT
      target_note_id,
      COUNT(*) as edge_count,
      SUM(weight) as total_influence
    FROM note_influence_edges
    GROUP BY target_note_id
    ORDER BY total_influence DESC
    LIMIT 5
  `);

  // 最も影響を与えているノート
  const topInfluencers = await db.all<{
    source_note_id: string;
    edge_count: number;
    total_influence: number;
  }>(sql`
    SELECT
      source_note_id,
      COUNT(*) as edge_count,
      SUM(weight) as total_influence
    FROM note_influence_edges
    GROUP BY source_note_id
    ORDER BY total_influence DESC
    LIMIT 5
  `);

  return {
    totalEdges: basicStats[0]?.total_edges ?? 0,
    avgWeight: basicStats[0]?.avg_weight ?? 0,
    maxWeight: basicStats[0]?.max_weight ?? 0,
    topInfluencedNotes: topInfluenced.map((r) => ({
      noteId: r.target_note_id,
      edgeCount: r.edge_count,
      totalInfluence: r.total_influence,
    })),
    topInfluencers: topInfluencers.map((r) => ({
      noteId: r.source_note_id,
      edgeCount: r.edge_count,
      totalInfluence: r.total_influence,
    })),
  };
}
