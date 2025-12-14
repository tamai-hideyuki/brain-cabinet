/**
 * Review Repository
 *
 * Spaced Review スケジュールと Active Recall 質問のデータアクセス
 */

import { db } from "../db/client";
import {
  reviewSchedules,
  recallQuestions,
  reviewSessions,
  type RecallQuality,
  type ScheduleSource,
  type RecallQuestionType,
  type QuestionSource,
} from "../db/schema";
import { eq, desc, asc, and, lte, sql } from "drizzle-orm";

// ============================================================
// Types
// ============================================================

export type ReviewSchedule = {
  id: number;
  noteId: string;
  easinessFactor: number;
  interval: number;
  repetition: number;
  nextReviewAt: number;
  lastReviewedAt: number | null;
  scheduledBy: ScheduleSource;
  isActive: boolean;
  fixedRevisionId: string | null;  // v4.6: 固定版ID（note_history.id）
  createdAt: number;
  updatedAt: number;
};

export type RecallQuestion = {
  id: number;
  noteId: string;
  questionType: RecallQuestionType;
  question: string;
  expectedKeywords: string[];
  source: QuestionSource;
  isActive: boolean;
  contentHash: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ReviewSession = {
  id: number;
  noteId: string;
  scheduleId: number;
  quality: RecallQuality;
  responseTimeMs: number | null;
  questionsAttempted: number | null;
  questionsCorrect: number | null;
  easinessFactorBefore: number | null;
  easinessFactorAfter: number | null;
  intervalBefore: number | null;
  intervalAfter: number | null;
  createdAt: number;
};

export type CreateQuestionInput = {
  questionType: RecallQuestionType;
  question: string;
  expectedKeywords?: string[];
  source?: QuestionSource;
  contentHash?: string;
};

export type CreateSessionInput = {
  noteId: string;
  scheduleId: number;
  quality: RecallQuality;
  responseTimeMs?: number;
  questionsAttempted?: number;
  questionsCorrect?: number;
  easinessFactorBefore?: number;
  easinessFactorAfter?: number;
  intervalBefore?: number;
  intervalAfter?: number;
};

export type ReviewStats = {
  totalReviews: number;
  avgQuality: number;
  avgResponseTimeMs: number | null;
  totalQuestionsAttempted: number;
  totalQuestionsCorrect: number;
  currentStreak: number;
};

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

// ============================================================
// Question Operations
// ============================================================

/**
 * 質問を作成
 */
export const createQuestion = async (
  noteId: string,
  input: CreateQuestionInput
): Promise<number> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .insert(recallQuestions)
    .values({
      noteId,
      questionType: input.questionType,
      question: input.question,
      expectedKeywords: input.expectedKeywords
        ? JSON.stringify(input.expectedKeywords)
        : null,
      source: input.source ?? "template",
      isActive: 1,
      contentHash: input.contentHash ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: recallQuestions.id });

  return result[0].id;
};

/**
 * 複数の質問を一括作成
 */
export const createQuestions = async (
  noteId: string,
  inputs: CreateQuestionInput[]
): Promise<number[]> => {
  const now = Math.floor(Date.now() / 1000);

  const values = inputs.map((input) => ({
    noteId,
    questionType: input.questionType,
    question: input.question,
    expectedKeywords: input.expectedKeywords
      ? JSON.stringify(input.expectedKeywords)
      : null,
    source: input.source ?? "template",
    isActive: 1,
    contentHash: input.contentHash ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  const result = await db
    .insert(recallQuestions)
    .values(values)
    .returning({ id: recallQuestions.id });

  return result.map((r) => r.id);
};

/**
 * ノートIDで質問を取得
 */
export const getQuestionsByNoteId = async (
  noteId: string,
  activeOnly = true
): Promise<RecallQuestion[]> => {
  let query = db
    .select()
    .from(recallQuestions)
    .where(eq(recallQuestions.noteId, noteId));

  if (activeOnly) {
    query = db
      .select()
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.noteId, noteId),
          eq(recallQuestions.isActive, 1)
        )
      );
  }

  const result = await query.orderBy(recallQuestions.createdAt);
  return result.map(parseQuestionRow);
};

/**
 * 質問を非アクティブ化（ノートID指定）
 */
export const deactivateQuestionsByNoteId = async (
  noteId: string
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(recallQuestions)
    .set({
      isActive: 0,
      updatedAt: now,
    })
    .where(eq(recallQuestions.noteId, noteId));
};

/**
 * 質問を削除（ノートID指定）
 */
export const deleteQuestionsByNoteId = async (
  noteId: string
): Promise<void> => {
  await db.delete(recallQuestions).where(eq(recallQuestions.noteId, noteId));
};

/**
 * コンテンツハッシュで質問の存在を確認
 */
export const hasQuestionsWithHash = async (
  noteId: string,
  contentHash: string
): Promise<boolean> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(recallQuestions)
    .where(
      and(
        eq(recallQuestions.noteId, noteId),
        eq(recallQuestions.contentHash, contentHash),
        eq(recallQuestions.isActive, 1)
      )
    );

  return (result[0]?.count ?? 0) > 0;
};

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
  const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
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

// ============================================================
// Helper Functions
// ============================================================

const parseScheduleRow = (
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

const parseQuestionRow = (
  row: typeof recallQuestions.$inferSelect
): RecallQuestion => ({
  id: row.id,
  noteId: row.noteId,
  questionType: row.questionType as RecallQuestionType,
  question: row.question,
  expectedKeywords: row.expectedKeywords
    ? JSON.parse(row.expectedKeywords)
    : [],
  source: row.source as QuestionSource,
  isActive: row.isActive === 1,
  contentHash: row.contentHash,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

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
// Table Creation (for migration)
// ============================================================

export const createReviewTables = async (): Promise<void> => {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS review_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      easiness_factor REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 1,
      repetition INTEGER NOT NULL DEFAULT 0,
      next_review_at INTEGER NOT NULL,
      last_reviewed_at INTEGER,
      scheduled_by TEXT NOT NULL DEFAULT 'auto',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS recall_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      question TEXT NOT NULL,
      expected_keywords TEXT,
      source TEXT NOT NULL DEFAULT 'template',
      is_active INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS review_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      schedule_id INTEGER NOT NULL,
      quality INTEGER NOT NULL,
      response_time_ms INTEGER,
      questions_attempted INTEGER,
      questions_correct INTEGER,
      easiness_factor_before REAL,
      easiness_factor_after REAL,
      interval_before INTEGER,
      interval_after INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  // インデックス作成
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedules_note_id
    ON review_schedules(note_id)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedules_next_review
    ON review_schedules(next_review_at) WHERE is_active = 1
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_recall_questions_note_id
    ON recall_questions(note_id)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_review_sessions_note_id
    ON review_sessions(note_id)
  `);
};
