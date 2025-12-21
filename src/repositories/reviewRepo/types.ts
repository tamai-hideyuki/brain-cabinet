/**
 * Review Repository - 型定義
 */

import type {
  RecallQuality,
  ScheduleSource,
  RecallQuestionType,
  QuestionSource,
} from "../../db/schema";

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
