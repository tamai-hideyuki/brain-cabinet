/**
 * Review Service
 *
 * Spaced Review + Active Recall の統合サービス
 * - レビュースケジュール管理（SM-2アルゴリズム）
 * - 質問生成・管理
 * - レビューセッション処理
 *
 * 設計原則: 自動スケジュールするが、レビュー実施は人間が決める
 */

import type { RecallQuality, NoteType, ScheduleSource } from "../../db/schema";
import {
  createSchedule,
  getScheduleByNoteId,
  getScheduleById,
  updateScheduleAfterReview,
  deactivateSchedule,
  reactivateSchedule,
  getDueReviews as getDueReviewsRepo,
  getUpcomingReviews,
  getOverdueCount,
  getAllActiveSchedules,
  rescheduleReview as rescheduleReviewRepo,
  createQuestions,
  getQuestionsByNoteId,
  deactivateQuestionsByNoteId,
  hasQuestionsWithHash,
  logReviewSession,
  getSessionsByNoteId,
  getReviewStats,
  getOverallStats,
  type ReviewSchedule,
  type RecallQuestion,
  type ReviewSession,
  type ReviewStats,
} from "../../repositories/reviewRepo";
import {
  calculateSM2,
  getInitialSM2State,
  adjustIntervalByNoteType,
  formatInterval,
  getQualityLabel,
  getEFDescription,
  previewNextIntervals,
  type SM2State,
} from "./sm2";
import {
  generateTemplateQuestions,
  toCreateQuestionInputs,
  generateContentHash,
  shouldGenerateQuestions,
  getQuestionTypeLabel,
} from "./questionGenerator";
import { logger } from "../../utils/logger";

// ============================================================
// Re-exports
// ============================================================

export {
  calculateSM2,
  getInitialSM2State,
  formatInterval,
  getQualityLabel,
  getEFDescription,
  previewNextIntervals,
} from "./sm2";

export {
  generateTemplateQuestions,
  generateContentHash,
  shouldGenerateQuestions,
  getQuestionTypeLabel,
} from "./questionGenerator";

export type {
  ReviewSchedule,
  RecallQuestion,
  ReviewSession,
  ReviewStats,
} from "../../repositories/reviewRepo";

// ============================================================
// Types
// ============================================================

export interface DueReviewItem {
  schedule: ReviewSchedule;
  noteId: string;
  isOverdue: boolean;
  daysSinceDue: number;
}

export interface ReviewQueueSummary {
  dueCount: number;
  overdueCount: number;
  upcomingCount: number;
  todayCount: number;
}

export interface StartReviewResult {
  scheduleId: number;
  noteId: string;
  currentState: SM2State;
  questions: RecallQuestion[];
  previews: {
    quality: RecallQuality;
    nextInterval: number;
    nextEF: number;
  }[];
}

export interface SubmitReviewInput {
  quality: RecallQuality;
  responseTimeMs?: number;
  questionsAttempted?: number;
  questionsCorrect?: number;
}

export interface SubmitReviewResult {
  success: boolean;
  previousState: SM2State;
  newState: SM2State;
  nextReviewAt: number;
  nextReviewIn: string;
  qualityLabel: string;
  efDescription: string;
}

// ============================================================
// Schedule Management
// ============================================================

/**
 * ノートのレビューをスケジュール
 */
export async function scheduleReviewForNote(
  noteId: string,
  content: string,
  noteType: NoteType,
  options?: { manual?: boolean }
): Promise<{ scheduleId: number; nextReviewAt: number } | null> {
  // learning/decision 以外はスケジュールしない
  if (!shouldGenerateQuestions(noteType)) {
    return null;
  }

  // 既存のアクティブなスケジュールがあるかチェック
  const existing = await getScheduleByNoteId(noteId);
  if (existing) {
    logger.debug({ noteId }, "Schedule already exists, skipping");
    return {
      scheduleId: existing.id,
      nextReviewAt: existing.nextReviewAt,
    };
  }

  // 初期間隔を計算（ノートタイプで調整）
  const baseInterval = 1;
  const adjustedInterval =
    noteType === "decision" || noteType === "learning"
      ? adjustIntervalByNoteType(baseInterval, noteType)
      : baseInterval;

  // スケジュール作成
  const scheduleId = await createSchedule(noteId, {
    initialInterval: adjustedInterval,
    scheduledBy: options?.manual ? "manual" : "auto",
  });

  // 質問を生成
  await regenerateQuestionsForNote(noteId, content, noteType);

  const schedule = await getScheduleById(scheduleId);

  logger.info(
    { noteId, scheduleId, nextReviewAt: schedule?.nextReviewAt },
    "Review scheduled"
  );

  return {
    scheduleId,
    nextReviewAt: schedule?.nextReviewAt ?? 0,
  };
}

/**
 * レビューをキャンセル（スケジュールを非アクティブ化）
 */
export async function cancelReview(noteId: string): Promise<void> {
  await deactivateSchedule(noteId);
  logger.info({ noteId }, "Review cancelled");
}

/**
 * レビューを再スケジュール
 */
export async function rescheduleReview(
  noteId: string,
  daysFromNow: number
): Promise<{ nextReviewAt: number }> {
  await rescheduleReviewRepo(noteId, daysFromNow);

  const schedule = await getScheduleByNoteId(noteId);
  const nextReviewAt = schedule?.nextReviewAt ?? 0;

  logger.info({ noteId, daysFromNow, nextReviewAt }, "Review rescheduled");

  return { nextReviewAt };
}

// ============================================================
// Due Reviews
// ============================================================

/**
 * 期限切れのレビュー一覧を取得
 */
export async function getDueReviewItems(options?: {
  limit?: number;
  includeOverdue?: boolean;
}): Promise<DueReviewItem[]> {
  const limit = options?.limit ?? 20;
  const schedules = await getDueReviewsRepo(limit);
  const now = Math.floor(Date.now() / 1000);

  return schedules.map((schedule) => {
    const secondsSinceDue = now - schedule.nextReviewAt;
    const daysSinceDue = Math.floor(secondsSinceDue / (24 * 60 * 60));

    return {
      schedule,
      noteId: schedule.noteId,
      isOverdue: secondsSinceDue > 0,
      daysSinceDue: Math.max(0, daysSinceDue),
    };
  });
}

/**
 * レビューキューのサマリーを取得
 */
export async function getReviewQueueSummary(): Promise<ReviewQueueSummary> {
  const now = Math.floor(Date.now() / 1000);
  const todayEnd = Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);

  const dueReviews = await getDueReviewsRepo(1000);
  const upcomingReviews = await getUpcomingReviews(7, 1000);

  const overdueCount = dueReviews.filter((s) => s.nextReviewAt < now).length;
  const todayCount = upcomingReviews.filter(
    (s) => s.nextReviewAt <= todayEnd
  ).length;

  return {
    dueCount: dueReviews.length,
    overdueCount,
    upcomingCount: upcomingReviews.length,
    todayCount,
  };
}

// ============================================================
// Review List (Grouped by Period)
// ============================================================

export interface ReviewListItem {
  noteId: string;
  noteTitle: string;
  nextReviewAt: number;
  interval: number;
  repetition: number;
  easinessFactor: number;
  isOverdue: boolean;
  daysUntilDue: number;
}

export interface ReviewListGrouped {
  overdue: ReviewListItem[];
  today: ReviewListItem[];
  tomorrow: ReviewListItem[];
  thisWeek: ReviewListItem[];
  later: ReviewListItem[];
  total: number;
}

/**
 * 全レビューリストを期間別にグルーピングして取得
 */
export async function getReviewListGrouped(): Promise<ReviewListGrouped> {
  const schedules = await getAllActiveSchedules();
  const now = Math.floor(Date.now() / 1000);

  // 今日の終了（ローカルタイム）
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todayEndTs = Math.floor(todayEnd.getTime() / 1000);

  // 明日
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const tomorrowEndTs = Math.floor(tomorrowEnd.getTime() / 1000);

  // 今週末（7日後）
  const weekEnd = new Date(todayEnd);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndTs = Math.floor(weekEnd.getTime() / 1000);

  const result: ReviewListGrouped = {
    overdue: [],
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    total: schedules.length,
  };

  // ノート情報を取得するために findNoteById をインポート済みと仮定
  const { findNoteById } = await import("../../repositories/notesRepo");

  for (const schedule of schedules) {
    const note = await findNoteById(schedule.noteId);
    const daysUntilDue = Math.ceil((schedule.nextReviewAt - now) / (24 * 60 * 60));

    const item: ReviewListItem = {
      noteId: schedule.noteId,
      noteTitle: note?.title ?? "Unknown",
      nextReviewAt: schedule.nextReviewAt,
      interval: schedule.interval,
      repetition: schedule.repetition,
      easinessFactor: schedule.easinessFactor,
      isOverdue: schedule.nextReviewAt < now,
      daysUntilDue,
    };

    if (schedule.nextReviewAt < now) {
      result.overdue.push(item);
    } else if (schedule.nextReviewAt <= todayEndTs) {
      result.today.push(item);
    } else if (schedule.nextReviewAt <= tomorrowEndTs) {
      result.tomorrow.push(item);
    } else if (schedule.nextReviewAt <= weekEndTs) {
      result.thisWeek.push(item);
    } else {
      result.later.push(item);
    }
  }

  return result;
}

// ============================================================
// Review Execution
// ============================================================

/**
 * レビューセッションを開始
 */
export async function startReview(noteId: string): Promise<StartReviewResult> {
  const schedule = await getScheduleByNoteId(noteId);
  if (!schedule) {
    throw new Error(`No active schedule found for note: ${noteId}`);
  }

  const questions = await getQuestionsByNoteId(noteId, true);

  const currentState: SM2State = {
    easinessFactor: schedule.easinessFactor,
    interval: schedule.interval,
    repetition: schedule.repetition,
  };

  const previews = previewNextIntervals(currentState);

  return {
    scheduleId: schedule.id,
    noteId,
    currentState,
    questions,
    previews,
  };
}

/**
 * レビュー結果を送信
 */
export async function submitReviewResult(
  scheduleId: number,
  input: SubmitReviewInput
): Promise<SubmitReviewResult> {
  const schedule = await getScheduleById(scheduleId);
  if (!schedule) {
    throw new Error(`Schedule not found: ${scheduleId}`);
  }

  const previousState: SM2State = {
    easinessFactor: schedule.easinessFactor,
    interval: schedule.interval,
    repetition: schedule.repetition,
  };

  // SM-2 計算
  const { newState, nextReviewAt } = calculateSM2(input.quality, previousState);

  // スケジュール更新
  await updateScheduleAfterReview(
    scheduleId,
    newState.easinessFactor,
    newState.interval,
    newState.repetition
  );

  // セッションログ記録
  await logReviewSession({
    noteId: schedule.noteId,
    scheduleId,
    quality: input.quality,
    responseTimeMs: input.responseTimeMs,
    questionsAttempted: input.questionsAttempted,
    questionsCorrect: input.questionsCorrect,
    easinessFactorBefore: previousState.easinessFactor,
    easinessFactorAfter: newState.easinessFactor,
    intervalBefore: previousState.interval,
    intervalAfter: newState.interval,
  });

  logger.info(
    {
      scheduleId,
      noteId: schedule.noteId,
      quality: input.quality,
      newInterval: newState.interval,
      newEF: newState.easinessFactor,
    },
    "Review submitted"
  );

  return {
    success: true,
    previousState,
    newState,
    nextReviewAt,
    nextReviewIn: formatInterval(newState.interval),
    qualityLabel: getQualityLabel(input.quality),
    efDescription: getEFDescription(newState.easinessFactor),
  };
}

// ============================================================
// Question Management
// ============================================================

/**
 * ノートの質問を再生成
 */
export async function regenerateQuestionsForNote(
  noteId: string,
  content: string,
  noteType: NoteType
): Promise<number> {
  if (!shouldGenerateQuestions(noteType)) {
    return 0;
  }

  const contentHash = generateContentHash(content);

  // 同じコンテンツハッシュの質問が既にあればスキップ
  const hasExisting = await hasQuestionsWithHash(noteId, contentHash);
  if (hasExisting) {
    logger.debug({ noteId, contentHash }, "Questions already exist for content");
    return 0;
  }

  // 既存の質問を非アクティブ化
  await deactivateQuestionsByNoteId(noteId);

  // 新しい質問を生成
  const generated = generateTemplateQuestions(content, noteType);
  const inputs = toCreateQuestionInputs(generated, contentHash);

  if (inputs.length === 0) {
    return 0;
  }

  await createQuestions(noteId, inputs);

  logger.info(
    { noteId, questionCount: inputs.length },
    "Questions regenerated"
  );

  return inputs.length;
}

/**
 * レビュー用の質問を取得
 */
export async function getQuestionsForReview(
  noteId: string
): Promise<RecallQuestion[]> {
  return getQuestionsByNoteId(noteId, true);
}

// ============================================================
// Statistics
// ============================================================

/**
 * ノートのレビュー統計を取得
 */
export async function getReviewStatsByNote(noteId: string): Promise<{
  schedule: ReviewSchedule | null;
  stats: ReviewStats;
  recentSessions: ReviewSession[];
}> {
  const schedule = await getScheduleByNoteId(noteId);
  const stats = await getReviewStats(noteId);
  const recentSessions = await getSessionsByNoteId(noteId, 10);

  return {
    schedule,
    stats,
    recentSessions,
  };
}

/**
 * 全体のレビュー統計を取得
 */
export async function getOverallReviewStats() {
  return getOverallStats();
}

// ============================================================
// Integration Hooks
// ============================================================

/**
 * ノートタイプ変更時のフック
 * inference サービスから呼び出される
 */
export async function handleNoteTypeChange(
  noteId: string,
  newType: NoteType,
  content: string,
  previousType?: NoteType
): Promise<void> {
  const shouldSchedule = shouldGenerateQuestions(newType);
  const wasSchedulable = previousType
    ? shouldGenerateQuestions(previousType)
    : false;

  if (shouldSchedule && !wasSchedulable) {
    // learning/decision になった → スケジュール作成
    await scheduleReviewForNote(noteId, content, newType);
  } else if (!shouldSchedule && wasSchedulable) {
    // learning/decision から外れた → スケジュール非アクティブ化
    await cancelReview(noteId);
  } else if (shouldSchedule && wasSchedulable) {
    // タイプは変わったがどちらもスケジュール対象 → 質問を再生成
    await regenerateQuestionsForNote(noteId, content, newType);
  }
}

/**
 * ノートコンテンツ更新時のフック
 */
export async function handleNoteContentUpdate(
  noteId: string,
  newContent: string,
  noteType: NoteType
): Promise<void> {
  if (!shouldGenerateQuestions(noteType)) {
    return;
  }

  // 質問を再生成（コンテンツハッシュで重複チェック）
  await regenerateQuestionsForNote(noteId, newContent, noteType);
}
