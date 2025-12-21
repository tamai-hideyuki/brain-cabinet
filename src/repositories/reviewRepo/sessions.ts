/**
 * Review Repository - セッション操作
 */

import { db } from "../../db/client";
import {
  reviewSchedules,
  reviewSessions,
  type RecallQuality,
} from "../../db/schema";
import { eq, desc, lte, sql } from "drizzle-orm";
import type { ReviewSession, CreateSessionInput, ReviewStats } from "./types";
import { getOverdueCount } from "./schedules";

// ============================================================
// Helper Functions
// ============================================================

const parseSessionRow = (
  row: typeof reviewSessions.$inferSelect
): ReviewSession => ({
  id: row.id,
  noteId: row.noteId,
  scheduleId: row.scheduleId,
  quality: row.quality as RecallQuality,
  responseTimeMs: row.responseTimeMs,
  questionsAttempted: row.questionsAttempted,
  questionsCorrect: row.questionsCorrect,
  easinessFactorBefore: row.easinessFactorBefore,
  easinessFactorAfter: row.easinessFactorAfter,
  intervalBefore: row.intervalBefore,
  intervalAfter: row.intervalAfter,
  createdAt: row.createdAt,
});

// ============================================================
// Session Operations
// ============================================================

/**
 * レビューセッションを記録
 */
export const logReviewSession = async (
  input: CreateSessionInput
): Promise<number> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .insert(reviewSessions)
    .values({
      noteId: input.noteId,
      scheduleId: input.scheduleId,
      quality: input.quality,
      responseTimeMs: input.responseTimeMs ?? null,
      questionsAttempted: input.questionsAttempted ?? null,
      questionsCorrect: input.questionsCorrect ?? null,
      easinessFactorBefore: input.easinessFactorBefore ?? null,
      easinessFactorAfter: input.easinessFactorAfter ?? null,
      intervalBefore: input.intervalBefore ?? null,
      intervalAfter: input.intervalAfter ?? null,
      createdAt: now,
    })
    .returning({ id: reviewSessions.id });

  return result[0].id;
};

/**
 * ノートIDでセッション履歴を取得
 */
export const getSessionsByNoteId = async (
  noteId: string,
  limit = 20
): Promise<ReviewSession[]> => {
  const result = await db
    .select()
    .from(reviewSessions)
    .where(eq(reviewSessions.noteId, noteId))
    .orderBy(desc(reviewSessions.createdAt))
    .limit(limit);

  return result.map(parseSessionRow);
};

/**
 * ノートのレビュー統計を取得
 */
export const getReviewStats = async (noteId: string): Promise<ReviewStats> => {
  const sessions = await db
    .select()
    .from(reviewSessions)
    .where(eq(reviewSessions.noteId, noteId))
    .orderBy(desc(reviewSessions.createdAt));

  if (sessions.length === 0) {
    return {
      totalReviews: 0,
      avgQuality: 0,
      avgResponseTimeMs: null,
      totalQuestionsAttempted: 0,
      totalQuestionsCorrect: 0,
      currentStreak: 0,
    };
  }

  const totalReviews = sessions.length;
  const avgQuality =
    sessions.reduce((sum, s) => sum + s.quality, 0) / totalReviews;

  const responseTimes = sessions
    .filter((s) => s.responseTimeMs !== null)
    .map((s) => s.responseTimeMs!);
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : null;

  const totalQuestionsAttempted = sessions.reduce(
    (sum, s) => sum + (s.questionsAttempted ?? 0),
    0
  );
  const totalQuestionsCorrect = sessions.reduce(
    (sum, s) => sum + (s.questionsCorrect ?? 0),
    0
  );

  // 連続成功回数（quality >= 3）
  let currentStreak = 0;
  for (const session of sessions) {
    if (session.quality >= 3) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    totalReviews,
    avgQuality,
    avgResponseTimeMs,
    totalQuestionsAttempted,
    totalQuestionsCorrect,
    currentStreak,
  };
};

/**
 * 全体のレビュー統計を取得
 */
export const getOverallStats = async () => {
  const now = Math.floor(Date.now() / 1000);

  // アクティブなスケジュール数
  const activeSchedules = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewSchedules)
    .where(eq(reviewSchedules.isActive, 1));

  // 期限切れ数
  const overdueCount = await getOverdueCount();

  // 今日のレビュー数
  const todaySessions = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewSessions)
    .where(lte(sql`${reviewSessions.createdAt}`, now));

  // 全セッションの平均品質
  const allSessions = await db.select().from(reviewSessions);
  const avgQuality =
    allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + s.quality, 0) / allSessions.length
      : 0;

  return {
    totalActiveSchedules: activeSchedules[0]?.count ?? 0,
    overdueCount,
    todayReviewCount: todaySessions[0]?.count ?? 0,
    totalSessions: allSessions.length,
    avgQuality,
  };
};
