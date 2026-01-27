/**
 * Drift Repository
 * Drift関連のDB操作を集約
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import type { DriftAnnotationLabel } from "../../db/schema";

// ============================================
// Types
// ============================================

export type DailyDriftRow = {
  date: string;
  total: number;
};

export type DailyDriftRawRow = {
  date: string;
  total: number;
  count: number;
};

export type AnnotationRow = {
  id: number;
  date: string;
  label: string;
  note: string | null;
  auto_phase: string | null;
  created_at: number;
  updated_at: number;
};

export type NoteHistoryDriftRow = {
  note_id: string;
  semantic_diff: string;
  created_at: number;
};

export type ClusterHistoryRow = {
  note_id: string;
  cluster_id: number;
  assigned_at: number;
};

// ============================================
// Daily Drift Data
// ============================================

/**
 * 日別のドリフトデータを取得（EMA計算用）
 */
export const findDailyDriftData = async (
  startTimestamp: number
): Promise<DailyDriftRow[]> => {
  return await db.all<DailyDriftRow>(sql`
    SELECT
      date(created_at, 'unixepoch') as date,
      SUM(CAST(semantic_diff AS REAL)) as total
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND created_at >= ${startTimestamp}
    GROUP BY date(created_at, 'unixepoch')
    ORDER BY date ASC
  `);
};

/**
 * 日別のドリフト raw データを取得（count付き）
 */
export const findDailyDriftRaw = async (
  startTimestamp: number
): Promise<DailyDriftRawRow[]> => {
  return await db.all<DailyDriftRawRow>(sql`
    SELECT
      date(created_at, 'unixepoch') as date,
      SUM(CAST(semantic_diff AS REAL)) as total,
      COUNT(*) as count
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND created_at >= ${startTimestamp}
    GROUP BY date(created_at, 'unixepoch')
    ORDER BY date ASC
  `);
};

// ============================================
// Drift Annotations
// ============================================

/**
 * 日付でアノテーションを取得
 */
export const findAnnotationByDate = async (
  date: string
): Promise<AnnotationRow | null> => {
  const row = await db.get<AnnotationRow>(sql`
    SELECT id, date, label, note, auto_phase, created_at, updated_at
    FROM drift_annotations
    WHERE date = ${date}
  `);
  return row ?? null;
};

/**
 * IDでアノテーションを取得
 */
export const findAnnotationById = async (
  id: number
): Promise<AnnotationRow | null> => {
  const row = await db.get<AnnotationRow>(sql`
    SELECT id, date, label, note, auto_phase, created_at, updated_at
    FROM drift_annotations
    WHERE id = ${id}
  `);
  return row ?? null;
};

/**
 * 期間内のアノテーションを取得
 */
export const findAnnotationsInRange = async (
  startDate: string,
  endDate: string
): Promise<AnnotationRow[]> => {
  return await db.all<AnnotationRow>(sql`
    SELECT id, date, label, note, auto_phase, created_at, updated_at
    FROM drift_annotations
    WHERE date >= ${startDate} AND date <= ${endDate}
    ORDER BY date ASC
  `);
};

/**
 * アノテーションを挿入
 */
export const insertAnnotation = async (
  date: string,
  label: DriftAnnotationLabel,
  note: string | null,
  autoPhase: string | null,
  createdAt: number,
  updatedAt: number
): Promise<void> => {
  await db.run(sql`
    INSERT INTO drift_annotations (date, label, note, auto_phase, created_at, updated_at)
    VALUES (${date}, ${label}, ${note}, ${autoPhase}, ${createdAt}, ${updatedAt})
  `);
};

/**
 * アノテーションを更新
 */
export const updateAnnotation = async (
  date: string,
  label: DriftAnnotationLabel,
  note: string | null,
  autoPhase: string | null,
  updatedAt: number
): Promise<void> => {
  await db.run(sql`
    UPDATE drift_annotations
    SET label = ${label},
        note = ${note},
        auto_phase = ${autoPhase},
        updated_at = ${updatedAt}
    WHERE date = ${date}
  `);
};

/**
 * IDでアノテーションを削除
 */
export const deleteAnnotationById = async (id: number): Promise<void> => {
  await db.run(sql`
    DELETE FROM drift_annotations
    WHERE id = ${id}
  `);
};

/**
 * 日付でアノテーションを削除
 */
export const deleteAnnotationByDate = async (date: string): Promise<void> => {
  await db.run(sql`
    DELETE FROM drift_annotations
    WHERE date = ${date}
  `);
};

// ============================================
// Drift Event Detection
// ============================================

/**
 * 閾値以上のsemantic_diffを持つnote_historyを取得
 */
export const findHistoryWithDriftAboveThreshold = async (
  threshold: number
): Promise<NoteHistoryDriftRow[]> => {
  return await db.all<NoteHistoryDriftRow>(sql`
    SELECT note_id, semantic_diff, created_at
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND CAST(semantic_diff AS REAL) >= ${threshold}
    ORDER BY created_at ASC
  `);
};

/**
 * クラスタ履歴を取得
 */
export const findAllClusterHistory = async (): Promise<ClusterHistoryRow[]> => {
  return await db.all<ClusterHistoryRow>(sql`
    SELECT note_id, cluster_id, assigned_at
    FROM cluster_history
    ORDER BY assigned_at ASC
  `);
};

/**
 * ドリフトイベントを挿入（メッセージ付き）
 */
export const insertDriftEventWithMessage = async (
  detectedAt: number,
  severity: string,
  type: string,
  message: string,
  relatedCluster: number | null
): Promise<void> => {
  await db.run(sql`
    INSERT INTO drift_events
      (detected_at, severity, type, message, related_cluster)
    VALUES
      (${detectedAt}, ${severity}, ${type}, ${message}, ${relatedCluster})
  `);
};

/**
 * 既存のドリフトイベントを全削除（リビルド用）
 */
export const deleteAllDriftEvents = async (): Promise<void> => {
  await db.run(sql`DELETE FROM drift_events`);
};

// ============================================
// Phase Detection
// ============================================

export type PhaseDetectionRow = {
  date: string;
  prev_cluster_id: number | null;
  new_cluster_id: number | null;
  semantic_diff: string | null;
  embedding: Buffer | null;
};

/**
 * 日別のphase判定用データを取得
 */
export const findPhaseDetectionData = async (
  startTimestamp: number
): Promise<PhaseDetectionRow[]> => {
  return await db.all<PhaseDetectionRow>(sql`
    SELECT
      date(nh.created_at, 'unixepoch') as date,
      nh.prev_cluster_id,
      nh.new_cluster_id,
      nh.semantic_diff,
      ne.embedding
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    LEFT JOIN note_embeddings ne ON nh.note_id = ne.note_id
    WHERE nh.semantic_diff IS NOT NULL
      AND nh.created_at >= ${startTimestamp}
    ORDER BY nh.created_at ASC
  `);
};

// ============================================
// Drift Direction Types
// ============================================

export type DriftHistoryWithEmbeddingsRow = {
  history_id: number;
  note_id: string;
  drift_score: string | null;
  old_embedding: Buffer | null;
  new_embedding: Buffer | null;
  old_cluster_id: number | null;
  new_cluster_id: number | null;
  created_at: number;
};

export type ClusterCentroidRow = {
  cluster_id: number;
  centroid: Buffer;
};

export type HistoryRow = {
  note_id: string;
  drift_score: string | null;
  old_embedding: Buffer | null;
  old_cluster_id: number | null;
};

export type CurrentEmbeddingRow = {
  embedding: Buffer;
  cluster_id: number | null;
};

export type NoteHistoryForRebuildRow = {
  id: string;
  note_id: string;
  semantic_diff: string | null;
  prev_cluster_id: number | null;
  new_cluster_id: number | null;
  created_at: number;
};

// ============================================
// Drift Direction Functions
// ============================================

/**
 * ドリフトイベントのある履歴と埋め込みを取得
 */
export const findDriftHistoriesWithEmbeddings = async (
  startTimestamp: number,
  minDriftScore: number
): Promise<DriftHistoryWithEmbeddingsRow[]> => {
  return await db.all<DriftHistoryWithEmbeddingsRow>(sql`
    SELECT
      nh.id as history_id,
      nh.note_id,
      nh.drift_score,
      nh.old_embedding,
      ne.embedding as new_embedding,
      nh.old_cluster_id,
      n.cluster_id as new_cluster_id,
      nh.created_at
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    LEFT JOIN note_embeddings ne ON nh.note_id = ne.note_id
    WHERE nh.drift_score IS NOT NULL
      AND nh.drift_score != ''
      AND CAST(nh.drift_score AS REAL) >= ${minDriftScore}
      AND nh.created_at >= ${startTimestamp}
      AND nh.old_embedding IS NOT NULL
      AND ne.embedding IS NOT NULL
    ORDER BY nh.created_at DESC
  `);
};

/**
 * 最新のクラスターセントロイドを取得
 */
export const findLatestClusterCentroids = async (): Promise<ClusterCentroidRow[]> => {
  return await db.all<ClusterCentroidRow>(sql`
    SELECT cluster_id, centroid
    FROM cluster_dynamics
    WHERE date = (SELECT MAX(date) FROM cluster_dynamics)
  `);
};

/**
 * 履歴IDで履歴を取得
 */
export const findHistoryById = async (
  historyId: number
): Promise<HistoryRow | null> => {
  const row = await db.get<HistoryRow>(sql`
    SELECT note_id, drift_score, old_embedding, old_cluster_id
    FROM note_history
    WHERE id = ${historyId}
  `);
  return row ?? null;
};

/**
 * ノートの現在の埋め込みとクラスタを取得
 */
export const findCurrentEmbeddingAndCluster = async (
  noteId: string
): Promise<CurrentEmbeddingRow | null> => {
  const row = await db.get<CurrentEmbeddingRow>(sql`
    SELECT ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
    WHERE ne.note_id = ${noteId}
  `);
  return row ?? null;
};

// ============================================
// Rebuild Drift Events Functions
// ============================================

/**
 * ドリフトイベントの数を取得
 */
export const countDriftEvents = async (): Promise<number> => {
  const result = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM drift_events
  `);
  return result[0]?.count ?? 0;
};

/**
 * 全てのnote_historyを取得（時系列順）
 */
export const findAllNoteHistory = async (): Promise<NoteHistoryForRebuildRow[]> => {
  return await db.all<NoteHistoryForRebuildRow>(sql`
    SELECT
      id,
      note_id,
      semantic_diff,
      prev_cluster_id,
      new_cluster_id,
      created_at
    FROM note_history
    ORDER BY created_at ASC
  `);
};
