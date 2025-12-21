/**
 * Review Repository
 *
 * Spaced Review スケジュールと Active Recall 質問のデータアクセス
 */

// 型定義
export type {
  ReviewSchedule,
  RecallQuestion,
  ReviewSession,
  CreateQuestionInput,
  CreateSessionInput,
  ReviewStats,
} from "./types";

// スケジュール操作
export {
  createSchedule,
  getScheduleByNoteId,
  getScheduleById,
  updateScheduleAfterReview,
  deactivateSchedule,
  reactivateSchedule,
  getDueReviews,
  getUpcomingReviews,
  getOverdueCount,
  getAllActiveSchedules,
  rescheduleReview,
  setFixedRevision,
  clearFixedRevision,
} from "./schedules";

// 質問操作
export {
  createQuestion,
  createQuestions,
  getQuestionsByNoteId,
  deactivateQuestionsByNoteId,
  deleteQuestionsByNoteId,
  hasQuestionsWithHash,
} from "./questions";

// セッション操作
export {
  logReviewSession,
  getSessionsByNoteId,
  getReviewStats,
  getOverallStats,
} from "./sessions";

// マイグレーション
export { createReviewTables } from "./migrations";
