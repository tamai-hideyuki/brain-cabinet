/**
 * Review Repository - スケジュール操作
 */

import { db } from "../../db/client";
import {
  reviewSchedules,
  type ScheduleSource,
} from "../../db/schema";
import { eq, desc, asc, and, lte, sql } from "drizzle-orm";
import type { ReviewSchedule } from "./types";

// ============================================================
// Helper Functions
// ============================================================

export const parseScheduleRow = (
  row: typeof reviewSchedules.$inferSelect
): ReviewSchedule => ({
  id: row.id,
  noteId: row.noteId,
  easinessFactor: row.easinessFactor,
  interval: row.interval,
  repetition: row.repetition,
  nextReviewAt: row.nextReviewAt,
  lastReviewedAt: row.lastReviewedAt,
  scheduledBy: row.scheduledBy as ScheduleSource,
  isActive: row.isActive === 1,
  fixedRevisionId: row.fixedRevisionId ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// ============================================================
// Schedule Operations
// ============================================================

/**
 * レビュースケジュールを作成
 */
export const createSchedule = async (
  noteId: string,
  options?: {
    initialInterval?: number;
    scheduledBy?: ScheduleSource;
  }
): Promise<number> => {
  const now = Math.floor(Date.now() / 1000);
  const interval = options?.initialInterval ?? 1;
  const nextReviewAt = now + interval * 24 * 60 * 60; // interval日後

  const result = await db
    .insert(reviewSchedules)
    .values({
      noteId,
      easinessFactor: 2.5,
      interval,
      repetition: 0,
      nextReviewAt,
      scheduledBy: options?.scheduledBy ?? "auto",
      isActive: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: reviewSchedules.id });

  return result[0].id;
};

/**
 * ノートIDでスケジュールを取得（アクティブなもののみ）
 */
export const getScheduleByNoteId = async (
  noteId: string
): Promise<ReviewSchedule | null> => {
  const result = await db
    .select()
    .from(reviewSchedules)
    .where(
      and(eq(reviewSchedules.noteId, noteId), eq(reviewSchedules.isActive, 1))
    )
    .orderBy(desc(reviewSchedules.updatedAt))
    .limit(1);

  if (result.length === 0) return null;
  return parseScheduleRow(result[0]);
};

/**
 * スケジュールIDでスケジュールを取得
 */
export const getScheduleById = async (
  id: number
): Promise<ReviewSchedule | null> => {
  const result = await db
    .select()
    .from(reviewSchedules)
    .where(eq(reviewSchedules.id, id))
    .limit(1);

  if (result.length === 0) return null;
  return parseScheduleRow(result[0]);
};

/**
 * レビュー後にスケジュールを更新
 */
export const updateScheduleAfterReview = async (
  scheduleId: number,
  newEasinessFactor: number,
  newInterval: number,
  newRepetition: number
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  const nextReviewAt = now + newInterval * 24 * 60 * 60;

  await db
    .update(reviewSchedules)
    .set({
      easinessFactor: newEasinessFactor,
      interval: newInterval,
      repetition: newRepetition,
      nextReviewAt,
      lastReviewedAt: now,
      updatedAt: now,
    })
    .where(eq(reviewSchedules.id, scheduleId));
};

/**
 * スケジュールを非アクティブ化
 */
export const deactivateSchedule = async (noteId: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(reviewSchedules)
    .set({
      isActive: 0,
      updatedAt: now,
    })
    .where(eq(reviewSchedules.noteId, noteId));
};

/**
 * スケジュールを再アクティブ化
 */
export const reactivateSchedule = async (noteId: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(reviewSchedules)
    .set({
      isActive: 1,
      updatedAt: now,
    })
    .where(eq(reviewSchedules.noteId, noteId));
};

/**
 * 期限切れのレビューを取得
 */
export const getDueReviews = async (
  limit = 20
): Promise<ReviewSchedule[]> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select()
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.isActive, 1),
        lte(reviewSchedules.nextReviewAt, now)
      )
    )
    .orderBy(reviewSchedules.nextReviewAt)
    .limit(limit);

  return result.map(parseScheduleRow);
};

/**
 * 今後のレビューを取得（daysAhead日以内）
 */
export const getUpcomingReviews = async (
  daysAhead = 7,
  limit = 20
): Promise<ReviewSchedule[]> => {
  const now = Math.floor(Date.now() / 1000);
  const futureLimit = now + daysAhead * 24 * 60 * 60;

  const result = await db
    .select()
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.isActive, 1),
        lte(reviewSchedules.nextReviewAt, futureLimit)
      )
    )
    .orderBy(reviewSchedules.nextReviewAt)
    .limit(limit);

  return result.map(parseScheduleRow);
};

/**
 * 期限切れレビューの件数を取得
 */
export const getOverdueCount = async (): Promise<number> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewSchedules)
    .where(
      and(
        eq(reviewSchedules.isActive, 1),
        lte(reviewSchedules.nextReviewAt, now)
      )
    );

  return result[0]?.count ?? 0;
};

/**
 * 全アクティブなレビュースケジュールを取得
 */
export const getAllActiveSchedules = async (): Promise<ReviewSchedule[]> => {
  const result = await db
    .select()
    .from(reviewSchedules)
    .where(eq(reviewSchedules.isActive, 1))
    .orderBy(asc(reviewSchedules.nextReviewAt));

  return result.map(parseScheduleRow);
};

/**
 * 次回レビュー日を手動で設定
 */
export const rescheduleReview = async (
  noteId: string,
  daysFromNow: number
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  const nextReviewAt = now + daysFromNow * 24 * 60 * 60;

  await db
    .update(reviewSchedules)
    .set({
      nextReviewAt,
      updatedAt: now,
    })
    .where(
      and(eq(reviewSchedules.noteId, noteId), eq(reviewSchedules.isActive, 1))
    );
};

/**
 * レビュー対象のバージョンを固定（v4.6）
 */
export const setFixedRevision = async (
  noteId: string,
  historyId: string
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(reviewSchedules)
    .set({
      fixedRevisionId: historyId,
      updatedAt: now,
    })
    .where(
      and(eq(reviewSchedules.noteId, noteId), eq(reviewSchedules.isActive, 1))
    );
};

/**
 * レビュー対象のバージョン固定を解除（v4.6）
 */
export const clearFixedRevision = async (noteId: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(reviewSchedules)
    .set({
      fixedRevisionId: null,
      updatedAt: now,
    })
    .where(
      and(eq(reviewSchedules.noteId, noteId), eq(reviewSchedules.isActive, 1))
    );
};
