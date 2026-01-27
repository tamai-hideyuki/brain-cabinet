/**
 * PTM Repository
 *
 * PTM (Personal Thinking Model) 関連のDB操作
 * - Dynamics: クラスタ動態クエリ
 * - Influence: 影響力エッジクエリ
 * - Snapshot: PTMスナップショット CRUD
 * - Core: 埋め込み・クラスタ統計
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// ============================================
// Dynamics - クラスタ動態クエリ
// ============================================

/**
 * クラスタ別Drift寄与を取得
 */
export async function findClusterDriftContribution(
  startTimestamp: number
): Promise<Array<{ new_cluster_id: number | null; drift_sum: number }>> {
  return db.all<{
    new_cluster_id: number | null;
    drift_sum: number;
  }>(sql`
    SELECT
      new_cluster_id,
      SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND new_cluster_id IS NOT NULL
      AND created_at >= ${startTimestamp}
    GROUP BY new_cluster_id
  `);
}

/**
 * 指定日のクラスタ安定性メトリクスを取得
 */
export async function findClusterStabilityMetrics(
  date: string
): Promise<Array<{
  cluster_id: number;
  cohesion: number;
  stability_score: number | null;
  note_count: number;
}>> {
  return db.all<{
    cluster_id: number;
    cohesion: number;
    stability_score: number | null;
    note_count: number;
  }>(sql`
    SELECT cluster_id, cohesion, stability_score, note_count
    FROM cluster_dynamics
    WHERE date = ${date}
    ORDER BY cluster_id
  `);
}

// ============================================
// Influence - 影響力エッジクエリ
// ============================================

/**
 * 影響力エッジの基本統計を取得
 */
export async function findInfluenceBasicStats(): Promise<{
  total_edges: number;
  avg_weight: number;
} | null> {
  const rows = await db.all<{
    total_edges: number;
    avg_weight: number;
  }>(sql`
    SELECT
      COUNT(*) as total_edges,
      AVG(weight) as avg_weight
    FROM note_influence_edges
  `);
  return rows[0] ?? null;
}

/**
 * Top Influencers（影響を与えているノート）を取得
 */
export async function findTopInfluencers(
  limit: number = 5
): Promise<Array<{
  source_note_id: string;
  out_weight: number;
  edge_count: number;
}>> {
  return db.all<{
    source_note_id: string;
    out_weight: number;
    edge_count: number;
  }>(sql`
    SELECT
      source_note_id,
      SUM(weight) as out_weight,
      COUNT(*) as edge_count
    FROM note_influence_edges
    GROUP BY source_note_id
    ORDER BY out_weight DESC
    LIMIT ${limit}
  `);
}

/**
 * Top Influenced（影響を受けているノート）を取得
 */
export async function findTopInfluenced(
  limit: number = 5
): Promise<Array<{
  target_note_id: string;
  in_weight: number;
  edge_count: number;
}>> {
  return db.all<{
    target_note_id: string;
    in_weight: number;
    edge_count: number;
  }>(sql`
    SELECT
      target_note_id,
      SUM(weight) as in_weight,
      COUNT(*) as edge_count
    FROM note_influence_edges
    GROUP BY target_note_id
    ORDER BY in_weight DESC
    LIMIT ${limit}
  `);
}

/**
 * クラスタが与えた影響を集計
 */
export async function findClusterGivenInfluence(): Promise<Array<{
  cluster_id: number;
  given: number;
}>> {
  return db.all<{
    cluster_id: number;
    given: number;
  }>(sql`
    SELECT
      n.cluster_id,
      SUM(e.weight) as given
    FROM note_influence_edges e
    JOIN notes n ON e.source_note_id = n.id
    WHERE n.cluster_id IS NOT NULL
    GROUP BY n.cluster_id
  `);
}

/**
 * クラスタが受けた影響を集計
 */
export async function findClusterReceivedInfluence(): Promise<Array<{
  cluster_id: number;
  received: number;
}>> {
  return db.all<{
    cluster_id: number;
    received: number;
  }>(sql`
    SELECT
      n.cluster_id,
      SUM(e.weight) as received
    FROM note_influence_edges e
    JOIN notes n ON e.target_note_id = n.id
    WHERE n.cluster_id IS NOT NULL
    GROUP BY n.cluster_id
  `);
}

/**
 * クラスタ間の影響フローを取得
 */
export async function findClusterInfluenceFlow(): Promise<Array<{
  source_cluster: number;
  target_cluster: number;
  total_weight: number;
}>> {
  return db.all<{
    source_cluster: number;
    target_cluster: number;
    total_weight: number;
  }>(sql`
    SELECT
      src.cluster_id as source_cluster,
      tgt.cluster_id as target_cluster,
      SUM(e.weight) as total_weight
    FROM note_influence_edges e
    JOIN notes src ON e.source_note_id = src.id
    JOIN notes tgt ON e.target_note_id = tgt.id
    WHERE src.cluster_id IS NOT NULL
      AND tgt.cluster_id IS NOT NULL
    GROUP BY src.cluster_id, tgt.cluster_id
    ORDER BY total_weight DESC
  `);
}

// ============================================
// Snapshot - PTMスナップショット CRUD
// ============================================

/**
 * 指定日のPTMスナップショットを削除
 */
export async function deletePtmSnapshotByDate(date: string): Promise<void> {
  await db.run(sql`DELETE FROM ptm_snapshots WHERE date(captured_at) = ${date}`);
}

/**
 * PTMスナップショットを保存
 */
export async function insertPtmSnapshot(params: {
  capturedAt: number;
  clusterStrengths: string;
  imbalanceScore: number;
  summary: string;
}): Promise<void> {
  await db.run(sql`
    INSERT INTO ptm_snapshots
      (captured_at, cluster_strengths, imbalance_score, summary)
    VALUES
      (${params.capturedAt}, ${params.clusterStrengths}, ${params.imbalanceScore}, ${params.summary})
  `);
}

/**
 * 最新のPTMスナップショットを取得
 */
export async function findLatestPtmSnapshot(): Promise<{ summary: string } | null> {
  const rows = await db.all<{
    summary: string;
  }>(sql`
    SELECT summary
    FROM ptm_snapshots
    ORDER BY captured_at DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

/**
 * PTMスナップショット履歴を取得
 */
export async function findPtmSnapshotHistory(
  limit: number = 7
): Promise<Array<{ summary: string }>> {
  return db.all<{
    summary: string;
  }>(sql`
    SELECT summary
    FROM ptm_snapshots
    ORDER BY captured_at DESC
    LIMIT ${limit}
  `);
}

// ============================================
// Core - 埋め込み・クラスタ統計
// ============================================

/**
 * 全ノートの埋め込みとクラスタ情報を取得
 */
export async function findAllNoteEmbeddingsWithCluster(): Promise<Array<{
  note_id: string;
  embedding: Buffer;
  cluster_id: number | null;
}>> {
  return db.all<{
    note_id: string;
    embedding: Buffer;
    cluster_id: number | null;
  }>(sql`
    SELECT ne.note_id, ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
  `);
}
