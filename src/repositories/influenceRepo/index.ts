/**
 * Influence Repository
 *
 * 影響エッジ・因果推論関連のDB操作
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// ============================================
// Influence Edge CRUD
// ============================================

/**
 * 影響エッジを挿入/更新
 */
export async function upsertInfluenceEdge(params: {
  sourceNoteId: string;
  targetNoteId: string;
  weight: number;
  cosineSim: number;
  driftScore: number;
  createdAt: number;
}): Promise<void> {
  await db.run(sql`
    INSERT INTO note_influence_edges
      (source_note_id, target_note_id, weight, cosine_sim, drift_score, created_at)
    VALUES
      (${params.sourceNoteId}, ${params.targetNoteId}, ${params.weight}, ${params.cosineSim}, ${params.driftScore}, ${params.createdAt})
    ON CONFLICT(source_note_id, target_note_id) DO UPDATE SET
      weight = excluded.weight,
      cosine_sim = excluded.cosine_sim,
      drift_score = excluded.drift_score,
      created_at = excluded.created_at
  `);
}

/**
 * 特定ノートの影響エッジを削除
 */
export async function deleteInfluenceEdgesByNoteId(noteId: string): Promise<void> {
  await db.run(sql`
    DELETE FROM note_influence_edges
    WHERE source_note_id = ${noteId} OR target_note_id = ${noteId}
  `);
}

/**
 * 全影響エッジを削除
 */
export async function deleteAllInfluenceEdges(): Promise<void> {
  await db.run(sql`DELETE FROM note_influence_edges`);
}

/**
 * 影響エッジ数を取得
 */
export async function countInfluenceEdges(): Promise<number> {
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM note_influence_edges
  `);
  return rows[0]?.count || 0;
}

// ============================================
// Influencers / Influenced Queries
// ============================================

/**
 * 特定ノートに影響を与えているノート一覧を取得
 */
export async function findInfluencersOf(
  noteId: string,
  limit: number
): Promise<Array<{
  source_note_id: string;
  target_note_id: string;
  weight: number;
  cosine_sim: number;
  drift_score: number;
  created_at: number;
  source_title: string | null;
  source_cluster_id: number | null;
}>> {
  return db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
    created_at: number;
    source_title: string | null;
    source_cluster_id: number | null;
  }>(sql`
    SELECT
      e.source_note_id,
      e.target_note_id,
      e.weight,
      e.cosine_sim,
      e.drift_score,
      e.created_at,
      n.title as source_title,
      n.cluster_id as source_cluster_id
    FROM note_influence_edges e
    LEFT JOIN notes n ON e.source_note_id = n.id
    WHERE e.target_note_id = ${noteId}
    ORDER BY e.weight DESC
    LIMIT ${limit}
  `);
}

/**
 * 特定ノートに影響を与えているノート一覧を取得（NOTE情報なし）
 */
export async function findInfluencersOfRaw(
  noteId: string,
  limit: number
): Promise<Array<{
  source_note_id: string;
  target_note_id: string;
  weight: number;
  cosine_sim: number;
  drift_score: number;
  created_at: number;
}>> {
  return db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
    created_at: number;
  }>(sql`
    SELECT source_note_id, target_note_id, weight, cosine_sim, drift_score, created_at
    FROM note_influence_edges
    WHERE target_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);
}

/**
 * 特定ノートが影響を与えているノート一覧を取得
 */
export async function findInfluencedBy(
  noteId: string,
  limit: number
): Promise<Array<{
  source_note_id: string;
  target_note_id: string;
  weight: number;
  cosine_sim: number;
  drift_score: number;
  created_at: number;
  target_title: string | null;
  target_cluster_id: number | null;
}>> {
  return db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
    created_at: number;
    target_title: string | null;
    target_cluster_id: number | null;
  }>(sql`
    SELECT
      e.source_note_id,
      e.target_note_id,
      e.weight,
      e.cosine_sim,
      e.drift_score,
      e.created_at,
      n.title as target_title,
      n.cluster_id as target_cluster_id
    FROM note_influence_edges e
    LEFT JOIN notes n ON e.target_note_id = n.id
    WHERE e.source_note_id = ${noteId}
    ORDER BY e.weight DESC
    LIMIT ${limit}
  `);
}

/**
 * 特定ノートが影響を与えているノート一覧を取得（NOTE情報なし）
 */
export async function findInfluencedByRaw(
  noteId: string,
  limit: number
): Promise<Array<{
  source_note_id: string;
  target_note_id: string;
  weight: number;
  cosine_sim: number;
  drift_score: number;
  created_at: number;
}>> {
  return db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
    created_at: number;
  }>(sql`
    SELECT source_note_id, target_note_id, weight, cosine_sim, drift_score, created_at
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);
}

// ============================================
// Graph Queries
// ============================================

/**
 * 全影響エッジを取得
 */
export async function findAllInfluenceEdges(
  limit: number
): Promise<Array<{
  source_note_id: string;
  target_note_id: string;
  weight: number;
  cosine_sim: number;
  drift_score: number;
  created_at: number;
}>> {
  return db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
    created_at: number;
  }>(sql`
    SELECT source_note_id, target_note_id, weight, cosine_sim, drift_score, created_at
    FROM note_influence_edges
    ORDER BY weight DESC
    LIMIT ${limit}
  `);
}

/**
 * 時間減衰統計用のエッジを取得
 */
export async function findAllEdgesForDecayStats(): Promise<Array<{
  weight: number;
  created_at: number;
}>> {
  return db.all<{
    weight: number;
    created_at: number;
  }>(sql`
    SELECT weight, created_at
    FROM note_influence_edges
  `);
}

/**
 * 影響統計の基本情報を取得
 */
export async function findInfluenceBasicStats(): Promise<{
  total_edges: number;
  avg_weight: number;
  max_weight: number;
} | null> {
  const rows = await db.all<{
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
  return rows[0] ?? null;
}

/**
 * 最も影響を受けたノートを取得
 */
export async function findTopInfluencedNotes(
  limit: number = 5
): Promise<Array<{
  target_note_id: string;
  edge_count: number;
  total_influence: number;
}>> {
  return db.all<{
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
    LIMIT ${limit}
  `);
}

/**
 * 最も影響を与えているノートを取得
 */
export async function findTopInfluencerNotes(
  limit: number = 5
): Promise<Array<{
  source_note_id: string;
  edge_count: number;
  total_influence: number;
}>> {
  return db.all<{
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
    LIMIT ${limit}
  `);
}

// ============================================
// Rebuild Graph Queries
// ============================================

/**
 * note_historyからsemantic_diffがある履歴を取得
 */
export async function findHistoryWithSemanticDiff(): Promise<Array<{
  note_id: string;
  semantic_diff: string | null;
  prev_cluster_id: number | null;
  new_cluster_id: number | null;
}>> {
  return db.all<{
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
}

// ============================================
// Causal Inference Queries
// ============================================

/**
 * ノートの時系列データを取得
 */
export async function findNoteTimeSeries(
  noteId: string,
  startDate: number
): Promise<Array<{
  note_id: string;
  created_at: number;
  drift_score: string | null;
  new_cluster_id: number | null;
}>> {
  return db.all<{
    note_id: string;
    created_at: number;
    drift_score: string | null;
    new_cluster_id: number | null;
  }>(sql`
    SELECT note_id, created_at, drift_score, new_cluster_id
    FROM note_history
    WHERE note_id = ${noteId}
      AND created_at >= ${startDate}
    ORDER BY created_at ASC
  `);
}

/**
 * クラスター全体の時系列データを取得
 */
export async function findClusterTimeSeries(
  clusterId: number,
  startDate: number
): Promise<Array<{
  date: string;
  total_drift: number;
  note_count: number;
}>> {
  return db.all<{
    date: string;
    total_drift: number;
    note_count: number;
  }>(sql`
    SELECT
      DATE(created_at, 'unixepoch') as date,
      SUM(CAST(drift_score AS REAL)) as total_drift,
      COUNT(*) as note_count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at >= ${startDate}
      AND nh.drift_score IS NOT NULL
    GROUP BY date
    ORDER BY date ASC
  `);
}

/**
 * 影響エッジの時系列データを取得
 */
export async function findInfluenceTimeSeries(
  targetNoteId: string,
  startDate: number
): Promise<Array<{
  date: string;
  drift_score: number;
}>> {
  return db.all<{
    date: string;
    drift_score: number;
  }>(sql`
    SELECT
      DATE(created_at, 'unixepoch') as date,
      CAST(drift_score AS REAL) as drift_score
    FROM note_history
    WHERE note_id = ${targetNoteId}
      AND created_at >= ${startDate}
      AND drift_score IS NOT NULL
    ORDER BY date ASC
  `);
}

/**
 * 因果関係分析用の影響元を取得
 */
export async function findInfluencersForCausal(
  noteId: string,
  limit: number
): Promise<Array<{
  source_note_id: string;
  weight: number;
}>> {
  return db.all<{
    source_note_id: string;
    weight: number;
  }>(sql`
    SELECT source_note_id, weight
    FROM note_influence_edges
    WHERE target_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);
}

/**
 * 因果関係分析用の影響先を取得
 */
export async function findInfluencedForCausal(
  noteId: string,
  limit: number
): Promise<Array<{
  target_note_id: string;
  weight: number;
}>> {
  return db.all<{
    target_note_id: string;
    weight: number;
  }>(sql`
    SELECT target_note_id, weight
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);
}

// ============================================
// Intervention Analysis Queries
// ============================================

/**
 * ノートの基本情報を取得（介入分析用）
 */
export async function findNoteForIntervention(
  noteId: string
): Promise<{
  cluster_id: number | null;
  created_at: number;
  updated_at: number;
} | undefined> {
  return db.get<{
    cluster_id: number | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT cluster_id, created_at, updated_at
    FROM notes
    WHERE id = ${noteId}
  `);
}

/**
 * 介入前のドリフトを取得
 */
export async function findDriftBefore(
  clusterId: number,
  startTime: number,
  endTime: number
): Promise<{
  avg_drift: number;
  count: number;
} | undefined> {
  return db.get<{
    avg_drift: number;
    count: number;
  }>(sql`
    SELECT
      AVG(CAST(drift_score AS REAL)) as avg_drift,
      COUNT(*) as count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at >= ${startTime}
      AND nh.created_at < ${endTime}
      AND nh.drift_score IS NOT NULL
  `);
}

/**
 * 影響を受けたノート数を取得
 */
export async function countAffectedNotes(noteId: string): Promise<number> {
  const result = await db.get<{ count: number }>(sql`
    SELECT COUNT(DISTINCT target_note_id) as count
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
  `);
  return result?.count || 0;
}

/**
 * 最初の有意な変化を取得
 */
export async function findFirstSignificantChange(
  clusterId: number,
  afterTime: number,
  threshold: number
): Promise<{ first_change: number } | undefined> {
  return db.get<{ first_change: number }>(sql`
    SELECT MIN(created_at) as first_change
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at > ${afterTime}
      AND nh.drift_score IS NOT NULL
      AND CAST(nh.drift_score AS REAL) > ${threshold}
  `);
}

// ============================================
// Counterfactual Analysis Queries
// ============================================

/**
 * ノート情報を取得（反実仮想分析用）
 */
export async function findNoteForCounterfactual(
  noteId: string
): Promise<{
  title: string;
  cluster_id: number | null;
  tags: string | null;
  created_at: number;
} | undefined> {
  return db.get<{
    title: string;
    cluster_id: number | null;
    tags: string | null;
    created_at: number;
  }>(sql`
    SELECT title, cluster_id, tags, created_at
    FROM notes
    WHERE id = ${noteId}
  `);
}

/**
 * このノートに依存するノートを取得
 */
export async function findDependentNotes(
  noteId: string,
  limit: number
): Promise<Array<{ target_note_id: string }>> {
  return db.all<{ target_note_id: string }>(sql`
    SELECT DISTINCT target_note_id
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);
}

/**
 * クラスター内のノート数を取得
 */
export async function countNotesInCluster(clusterId: number): Promise<number> {
  const result = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM notes
    WHERE cluster_id = ${clusterId}
  `);
  return result?.count || 0;
}

/**
 * クラスター内でこのノートより前に作成されたノート数を取得
 */
export async function countEarlierNotesInCluster(
  clusterId: number,
  createdAt: number
): Promise<number> {
  const result = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM notes
    WHERE cluster_id = ${clusterId}
      AND created_at < ${createdAt}
  `);
  return result?.count || 0;
}

/**
 * ノートの総影響量を取得
 */
export async function findTotalInfluence(noteId: string): Promise<number> {
  const result = await db.get<{ total: number }>(sql`
    SELECT SUM(weight) as total
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
  `);
  return result?.total || 0;
}

/**
 * 最大影響量を取得
 */
export async function findMaxInfluence(): Promise<number> {
  const result = await db.get<{ max: number }>(sql`
    SELECT MAX(total) as max
    FROM (
      SELECT SUM(weight) as total
      FROM note_influence_edges
      GROUP BY source_note_id
    )
  `);
  return result?.max || 0;
}

/**
 * クラスター変更を誘発した数を取得
 */
export async function countClusterChanges(noteId: string): Promise<number> {
  const result = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM note_history
    WHERE note_id IN (
      SELECT target_note_id FROM note_influence_edges WHERE source_note_id = ${noteId}
    )
    AND prev_cluster_id IS NOT NULL
    AND new_cluster_id IS NOT NULL
    AND prev_cluster_id != new_cluster_id
  `);
  return result?.count || 0;
}

// ============================================
// Global Causal Summary Queries
// ============================================

/**
 * エッジ統計を取得
 */
export async function findEdgeStats(): Promise<{
  total: number;
  avg_weight: number;
} | undefined> {
  return db.get<{
    total: number;
    avg_weight: number;
  }>(sql`
    SELECT COUNT(*) as total, AVG(weight) as avg_weight
    FROM note_influence_edges
  `);
}

/**
 * 強い影響関係の数を取得
 */
export async function countStrongRelations(threshold: number): Promise<number> {
  const result = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM note_influence_edges
    WHERE weight > ${threshold}
  `);
  return result?.count || 0;
}

/**
 * Top Influencers（強い影響関係）を取得
 */
export async function findTopCausalInfluencers(
  minWeight: number,
  limit: number
): Promise<Array<{
  source_note_id: string;
  caused_count: number;
  avg_strength: number;
}>> {
  return db.all<{
    source_note_id: string;
    caused_count: number;
    avg_strength: number;
  }>(sql`
    SELECT
      source_note_id,
      COUNT(*) as caused_count,
      AVG(weight) as avg_strength
    FROM note_influence_edges
    WHERE weight > ${minWeight}
    GROUP BY source_note_id
    ORDER BY caused_count DESC
    LIMIT ${limit}
  `);
}

/**
 * ピボットノートを取得
 */
export async function findPivotNotes(
  limit: number
): Promise<Array<{
  note_id: string;
  title: string;
  pivot_count: number;
}>> {
  return db.all<{
    note_id: string;
    title: string;
    pivot_count: number;
  }>(sql`
    SELECT
      n.id as note_id,
      n.title,
      COUNT(DISTINCT nh.note_id) as pivot_count
    FROM notes n
    JOIN note_influence_edges nie ON n.id = nie.source_note_id
    JOIN note_history nh ON nie.target_note_id = nh.note_id
    WHERE nh.prev_cluster_id IS NOT NULL
      AND nh.new_cluster_id IS NOT NULL
      AND nh.prev_cluster_id != nh.new_cluster_id
    GROUP BY n.id
    ORDER BY pivot_count DESC
    LIMIT ${limit}
  `);
}
