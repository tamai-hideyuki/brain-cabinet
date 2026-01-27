/**
 * Analytics Repository
 * 分析に必要なDB操作を集約
 */

import { db } from "../../db/client";
import { notes, noteHistory } from "../../db/schema";
import { sql, gte } from "drizzle-orm";

// ============================================
// Types
// ============================================

export type NoteHistoryRow = {
  createdAt: number;
  semanticDiff: string | null;
};

export type NoteTimestampRow = {
  createdAt: number;
  updatedAt: number;
};

export type NoteWithClusterRow = {
  id: string;
  title: string;
  clusterId: number | null;
  createdAt: number;
};

export type NoteClusterCreatedRow = {
  clusterId: number | null;
  createdAt: number;
};

export type DailyActivityRaw = {
  date: string;
  cluster_id: number;
  count: number;
};

// ============================================
// Query Functions
// ============================================

/**
 * 期間内のノート履歴を取得
 */
export const findNoteHistoryInRange = async (
  startTimestamp: number,
  endTimestamp: number
): Promise<NoteHistoryRow[]> => {
  return await db
    .select({
      createdAt: noteHistory.createdAt,
      semanticDiff: noteHistory.semanticDiff,
    })
    .from(noteHistory)
    .where(
      sql`${noteHistory.createdAt} >= ${startTimestamp} AND ${noteHistory.createdAt} <= ${endTimestamp}`
    )
    .orderBy(noteHistory.createdAt);
};

/**
 * 期間内のノート作成/更新タイムスタンプを取得
 */
export const findNoteTimestampsInRange = async (
  startTimestamp: number
): Promise<NoteTimestampRow[]> => {
  return await db
    .select({
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      sql`${notes.createdAt} >= ${startTimestamp} OR ${notes.updatedAt} >= ${startTimestamp}`
    );
};

/**
 * 期間内のノート（クラスタ情報付き）を取得
 */
export const findNotesWithClusterInRange = async (
  startTimestamp: number,
  endTimestamp: number
): Promise<NoteWithClusterRow[]> => {
  return await db
    .select({
      id: notes.id,
      title: notes.title,
      clusterId: notes.clusterId,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      sql`${notes.createdAt} >= ${startTimestamp} AND ${notes.createdAt} <= ${endTimestamp}`
    )
    .orderBy(notes.createdAt);
};

/**
 * 年間のノート作成日を取得
 */
export const findNoteCreationsInYear = async (
  startOfYear: number,
  endOfYear: number
): Promise<{ createdAt: number }[]> => {
  return await db
    .select({
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      sql`${notes.createdAt} >= ${startOfYear} AND ${notes.createdAt} <= ${endOfYear}`
    );
};

/**
 * 年間のノート履歴作成日を取得
 */
export const findNoteHistoryInYear = async (
  startOfYear: number,
  endOfYear: number
): Promise<{ createdAt: number }[]> => {
  return await db
    .select({
      createdAt: noteHistory.createdAt,
    })
    .from(noteHistory)
    .where(
      sql`${noteHistory.createdAt} >= ${startOfYear} AND ${noteHistory.createdAt} <= ${endOfYear}`
    );
};

/**
 * 期間内のノート（クラスタあり）を取得
 */
export const findNotesWithClusterInRangeForTrend = async (
  startTimestamp: number,
  endTimestamp: number
): Promise<NoteClusterCreatedRow[]> => {
  return await db
    .select({
      clusterId: notes.clusterId,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(
      sql`${notes.createdAt} >= ${startTimestamp} AND ${notes.createdAt} <= ${endTimestamp} AND ${notes.clusterId} IS NOT NULL`
    )
    .orderBy(notes.createdAt);
};

/**
 * ノート総数を取得
 */
export const countAllNotes = async (): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes);
  return result[0]?.count ?? 0;
};

/**
 * 指定タイムスタンプ以降のノート数を取得
 */
export const countNotesSince = async (since: number): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes)
    .where(gte(notes.createdAt, since));
  return result[0]?.count ?? 0;
};

/**
 * 指定タイムスタンプ以降の履歴数を取得
 */
export const countHistorySince = async (since: number): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(noteHistory)
    .where(gte(noteHistory.createdAt, since));
  return result[0]?.count ?? 0;
};

/**
 * 指定期間の平均semantic diffを取得
 */
export const getAvgSemanticDiffSince = async (since: number): Promise<number> => {
  const result = await db
    .select({
      avg: sql<string>`avg(cast(semantic_diff as real))`,
    })
    .from(noteHistory)
    .where(
      sql`${noteHistory.createdAt} >= ${since} AND ${noteHistory.semanticDiff} IS NOT NULL`
    );
  return result[0]?.avg ? parseFloat(result[0].avg) : 0;
};

/**
 * クラスター別日次ノート作成数を取得（raw SQL）
 */
export const findClusterDailyNoteCreations = async (
  startDate: number
): Promise<DailyActivityRaw[]> => {
  return await db.all<DailyActivityRaw>(sql`
    SELECT
      date(created_at, 'unixepoch') as date,
      cluster_id,
      count(*) as count
    FROM notes
    WHERE created_at >= ${startDate}
      AND cluster_id IS NOT NULL
    GROUP BY date, cluster_id
  `);
};

/**
 * クラスター別日次ノート更新数を取得（raw SQL）
 */
export const findClusterDailyNoteUpdates = async (
  startDate: number
): Promise<DailyActivityRaw[]> => {
  return await db.all<DailyActivityRaw>(sql`
    SELECT
      date(nh.created_at, 'unixepoch') as date,
      n.cluster_id,
      count(*) as count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE nh.created_at >= ${startDate}
      AND n.cluster_id IS NOT NULL
    GROUP BY date, n.cluster_id
  `);
};
