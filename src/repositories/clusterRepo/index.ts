import { db } from "../../db/client";
import { clusters, notes, clusterHistory } from "../../db/schema";
import { eq, sql } from "drizzle-orm";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ClusterInput = {
  id: number;
  centroid: number[];
  size: number;
  sampleNoteId: string | null;
};

/**
 * クラスタを保存（UPSERT）
 */
export const saveCluster = async (data: ClusterInput) => {
  const now = Math.floor(Date.now() / 1000);
  const centroidBase64 = arrayToBase64(data.centroid);

  await db.run(sql`
    INSERT INTO clusters (id, centroid, size, sample_note_id, created_at, updated_at)
    VALUES (${data.id}, ${centroidBase64}, ${data.size}, ${data.sampleNoteId}, ${now}, ${now})
    ON CONFLICT(id) DO UPDATE SET
      centroid = ${centroidBase64},
      size = ${data.size},
      sample_note_id = ${data.sampleNoteId},
      updated_at = ${now}
  `);
};

/**
 * 複数クラスタを一括保存
 */
export const saveClusters = async (clusterList: ClusterInput[]) => {
  for (const cluster of clusterList) {
    await saveCluster(cluster);
  }
};

/**
 * 全クラスタを削除
 */
export const deleteAllClusters = async () => {
  await db.delete(clusters);
};

/**
 * 全クラスタを取得
 */
export const findAllClusters = async () => {
  const result = await db.select().from(clusters);
  return result.map((c) => ({
    ...c,
    centroid: c.centroid ? base64ToArray(c.centroid) : null,
  }));
};

/**
 * 特定クラスタを取得
 */
export const findClusterById = async (id: number) => {
  const result = await db
    .select()
    .from(clusters)
    .where(eq(clusters.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const c = result[0];
  return {
    ...c,
    centroid: c.centroid ? base64ToArray(c.centroid) : null,
  };
};

/**
 * クラスタに属するノートを取得
 */
export const findNotesByClusterId = async (clusterId: number) => {
  return await db
    .select()
    .from(notes)
    .where(eq(notes.clusterId, clusterId));
};

/**
 * ノートのcluster_idを更新
 */
export const updateNoteClusterId = async (noteId: string, clusterId: number) => {
  await db
    .update(notes)
    .set({ clusterId })
    .where(eq(notes.id, noteId));
};

/**
 * 全ノートのcluster_idを一括更新（バッチ処理）
 */
export const updateAllNoteClusterIds = async (
  assignments: Array<{ noteId: string; clusterId: number }>
) => {
  for (const { noteId, clusterId } of assignments) {
    await updateNoteClusterId(noteId, clusterId);
  }
};

/**
 * 全ノートのcluster_idをリセット
 */
export const resetAllNoteClusterIds = async () => {
  await db.run(sql`UPDATE notes SET cluster_id = NULL`);
};

// ヘルパー関数

/**
 * number[] を Base64 文字列に変換
 */
export const arrayToBase64 = (arr: number[]): string => {
  const float32 = new Float32Array(arr);
  const buffer = Buffer.from(float32.buffer);
  return buffer.toString("base64");
};

/**
 * Base64 文字列を number[] に変換
 */
export const base64ToArray = (base64: string): number[] => {
  const buffer = Buffer.from(base64, "base64");
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32);
};

/**
 * 特定ノートのクラスタ履歴を削除（トランザクション対応）
 */
export const deleteClusterHistoryByNoteIdRaw = async (
  tx: Transaction,
  noteId: string
) => {
  await tx.delete(clusterHistory).where(eq(clusterHistory.noteId, noteId));
};

// ============================================================
// Cluster Identity 用クエリ
// ============================================================

export type CentroidRow = {
  centroid: Buffer;
};

export type NoteWithEmbeddingRow = {
  note_id: string;
  title: string;
  category: string | null;
  embedding: Buffer;
};

export type ClusterInfoRow = {
  note_count: number;
  cohesion: number;
};

export type DriftSumRow = {
  drift_sum: number;
};

export type InfluenceSumRow = {
  total: number;
};

/**
 * クラスタの最新centroidを取得
 */
export const findLatestCentroid = async (clusterId: number): Promise<CentroidRow | null> => {
  const rows = await db.all<CentroidRow>(sql`
    SELECT centroid FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
    ORDER BY date DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
};

/**
 * クラスタに属するノートとembeddingを取得
 */
export const findNotesWithEmbeddingByClusterId = async (
  clusterId: number
): Promise<NoteWithEmbeddingRow[]> => {
  return db.all<NoteWithEmbeddingRow>(sql`
    SELECT n.id as note_id, n.title, n.category, ne.embedding
    FROM notes n
    JOIN note_embeddings ne ON n.id = ne.note_id
    WHERE n.cluster_id = ${clusterId}
  `);
};

/**
 * クラスタの基本情報を取得
 */
export const findClusterDynamicsInfo = async (clusterId: number): Promise<ClusterInfoRow | null> => {
  const rows = await db.all<ClusterInfoRow>(sql`
    SELECT note_count, cohesion
    FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
    ORDER BY date DESC
    LIMIT 1
  `);
  return rows[0] ?? null;
};

/**
 * クラスタのdrift合計を取得
 */
export const findClusterDriftSum = async (
  clusterId: number,
  startTimestamp: number
): Promise<number> => {
  const rows = await db.all<DriftSumRow>(sql`
    SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND new_cluster_id = ${clusterId}
      AND created_at >= ${startTimestamp}
  `);
  return rows[0]?.drift_sum ?? 0;
};

/**
 * 全体のdrift合計を取得
 */
export const findTotalDriftSum = async (startTimestamp: number): Promise<number> => {
  const rows = await db.all<DriftSumRow>(sql`
    SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND created_at >= ${startTimestamp}
  `);
  return rows[0]?.drift_sum ?? 0;
};

/**
 * クラスタの期間内drift合計を取得
 */
export const findClusterDriftSumInRange = async (
  clusterId: number,
  startTimestamp: number,
  endTimestamp?: number
): Promise<number> => {
  if (endTimestamp !== undefined) {
    const rows = await db.all<DriftSumRow>(sql`
      SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
      FROM note_history
      WHERE semantic_diff IS NOT NULL
        AND new_cluster_id = ${clusterId}
        AND created_at >= ${startTimestamp}
        AND created_at < ${endTimestamp}
    `);
    return rows[0]?.drift_sum ?? 0;
  }
  return findClusterDriftSum(clusterId, startTimestamp);
};

/**
 * クラスタのoutDegree（影響を与えた合計）を取得
 */
export const findClusterOutDegree = async (clusterId: number): Promise<number> => {
  const rows = await db.all<InfluenceSumRow>(sql`
    SELECT SUM(e.weight) as total
    FROM note_influence_edges e
    JOIN notes n ON e.source_note_id = n.id
    WHERE n.cluster_id = ${clusterId}
  `);
  return rows[0]?.total ?? 0;
};

/**
 * クラスタのinDegree（影響を受けた合計）を取得
 */
export const findClusterInDegree = async (clusterId: number): Promise<number> => {
  const rows = await db.all<InfluenceSumRow>(sql`
    SELECT SUM(e.weight) as total
    FROM note_influence_edges e
    JOIN notes n ON e.target_note_id = n.id
    WHERE n.cluster_id = ${clusterId}
  `);
  return rows[0]?.total ?? 0;
};

/**
 * 全クラスタIDを取得
 */
export const findAllClusterIds = async (): Promise<number[]> => {
  const rows = await db.all<{ cluster_id: number }>(sql`
    SELECT DISTINCT cluster_id FROM cluster_dynamics
    ORDER BY cluster_id
  `);
  return rows.map((r) => r.cluster_id);
};

// ============================================================
// Cluster Label 用クエリ
// ============================================================

export type NoteContentRow = {
  id: string;
  content: string;
  title: string | null;
};

export type IdentityIdRow = {
  id: number;
};

/**
 * identity_idに属するノートを取得（snapshot経由）
 */
export const findNotesByIdentityId = async (identityId: number): Promise<NoteContentRow[]> => {
  return db.all<NoteContentRow>(sql`
    SELECT n.id, n.content, n.title
    FROM notes n
    JOIN snapshot_note_assignments sna ON n.id = sna.note_id
    JOIN snapshot_clusters sc ON sna.snapshot_id = sc.snapshot_id AND sna.cluster_id = sc.id
    WHERE sc.identity_id = ${identityId}
    AND n.deleted_at IS NULL
    LIMIT 100
  `);
};

/**
 * identity_idに属するノートを取得（直接cluster_id経由）
 */
export const findNotesByIdentityIdDirect = async (identityId: number): Promise<NoteContentRow[]> => {
  return db.all<NoteContentRow>(sql`
    SELECT id, content, title
    FROM notes
    WHERE cluster_id IN (
      SELECT sc.local_id
      FROM snapshot_clusters sc
      WHERE sc.identity_id = ${identityId}
    )
    AND deleted_at IS NULL
    LIMIT 100
  `);
};

/**
 * アクティブなクラスタidentityを取得
 */
export const findActiveIdentities = async (includeWithLabel: boolean): Promise<IdentityIdRow[]> => {
  if (includeWithLabel) {
    return db.all<IdentityIdRow>(sql`SELECT id FROM cluster_identities WHERE is_active = 1`);
  }
  return db.all<IdentityIdRow>(sql`SELECT id FROM cluster_identities WHERE is_active = 1 AND (label IS NULL OR label = '')`);
};

/**
 * クラスタidentityのラベルを更新
 */
export const updateIdentityLabel = async (identityId: number, label: string): Promise<void> => {
  await db.run(sql`
    UPDATE cluster_identities
    SET label = ${label}
    WHERE id = ${identityId}
  `);
};

// ============================================================
// Cluster Dynamics 用クエリ
// ============================================================

export type AllClusterIdRow = {
  id: number;
};

export type NoteEmbeddingRow = {
  note_id: string;
  embedding: Buffer;
  cluster_id: number | null;
};

export type PreviousCentroidRow = {
  cluster_id: number;
  centroid: Buffer;
};

export type DynamicsRow = {
  cluster_id: number;
  centroid: Buffer;
  cohesion: number;
  note_count: number;
  interactions: string | null;
  stability_score: number | null;
};

export type TimelineRow = {
  date: string;
  cohesion: number;
  note_count: number;
  stability_score: number | null;
};

/**
 * 指定日のcluster_dynamicsを削除
 */
export const deleteDynamicsByDate = async (date: string): Promise<void> => {
  await db.run(sql`DELETE FROM cluster_dynamics WHERE date = ${date}`);
};

/**
 * 全クラスタIDを取得（clustersテーブルから）
 */
export const findAllClusterIdsFromClusters = async (): Promise<AllClusterIdRow[]> => {
  return db.all<AllClusterIdRow>(sql`
    SELECT DISTINCT id FROM clusters ORDER BY id
  `);
};

/**
 * 全ノートのembeddingとcluster_idを取得
 */
export const findAllNoteEmbeddings = async (): Promise<NoteEmbeddingRow[]> => {
  return db.all<NoteEmbeddingRow>(sql`
    SELECT ne.note_id, ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
  `);
};

/**
 * 指定日のcluster_dynamics centroidを取得
 */
export const findPreviousCentroids = async (date: string): Promise<PreviousCentroidRow[]> => {
  return db.all<PreviousCentroidRow>(sql`
    SELECT cluster_id, centroid FROM cluster_dynamics WHERE date = ${date}
  `);
};

/**
 * cluster_dynamicsを保存
 */
export const insertClusterDynamics = async (params: {
  date: string;
  clusterId: number;
  centroidBuffer: Buffer;
  cohesion: number;
  noteCount: number;
  interactionsJson: string;
  stabilityScore: number | null;
}): Promise<void> => {
  await db.run(sql`
    INSERT INTO cluster_dynamics
      (date, cluster_id, centroid, cohesion, note_count, interactions, stability_score, created_at)
    VALUES
      (${params.date}, ${params.clusterId}, ${params.centroidBuffer}, ${params.cohesion}, ${params.noteCount}, ${params.interactionsJson}, ${params.stabilityScore}, datetime('now'))
  `);
};

/**
 * 指定日のcluster_dynamicsを取得
 */
export const findDynamicsByDate = async (date: string): Promise<DynamicsRow[]> => {
  return db.all<DynamicsRow>(sql`
    SELECT cluster_id, centroid, cohesion, note_count, interactions, stability_score
    FROM cluster_dynamics
    WHERE date = ${date}
    ORDER BY cluster_id
  `);
};

/**
 * クラスタのdynamicsタイムラインを取得
 */
export const findDynamicsTimeline = async (
  clusterId: number,
  startDate: string
): Promise<TimelineRow[]> => {
  return db.all<TimelineRow>(sql`
    SELECT date, cohesion, note_count, stability_score
    FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
      AND date >= ${startDate}
    ORDER BY date ASC
  `);
};
