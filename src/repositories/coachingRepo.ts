/**
 * 苫米地式コーチングセッションリポジトリ
 * セッションとメッセージの永続化
 */

import { db } from "../db/client";
import {
  coachingSessions,
  coachingMessages,
  type CoachingPhase,
  type CoachingStatus,
  type CoachingInsights,
} from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// セッションの型
export type CoachingSession = {
  id: string;
  currentPhase: CoachingPhase;
  status: CoachingStatus;
  totalTurns: number;
  phaseProgress: Record<CoachingPhase, number> | null;
  insights: CoachingInsights | null;
  startedAt: number;
  completedAt: number | null;
  lastActiveAt: number;
};

// メッセージの型
export type CoachingMessage = {
  id: number;
  sessionId: string;
  turn: number;
  phase: CoachingPhase;
  role: "coach" | "user";
  content: string;
  promptType: string | null;
  extractedInsights: Record<string, unknown> | null;
  createdAt: number;
};

// 新規セッション作成の入力型
export type CreateSessionInput = {
  initialPhase?: CoachingPhase;
};

// メッセージ追加の入力型
export type AddMessageInput = {
  sessionId: string;
  turn: number;
  phase: CoachingPhase;
  role: "coach" | "user";
  content: string;
  promptType?: string;
  extractedInsights?: Record<string, unknown>;
};

/**
 * 新規セッションを作成
 */
export const createSession = async (
  input: CreateSessionInput = {}
): Promise<CoachingSession> => {
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const initialPhase = input.initialPhase ?? "goal_setting";

  const initialProgress: Record<CoachingPhase, number> = {
    goal_setting: 0,
    abstraction: 0,
    self_talk: 0,
    integration: 0,
  };

  const initialInsights: CoachingInsights = {
    goals: [],
    scotomas: [],
    affirmations: [],
  };

  await db.insert(coachingSessions).values({
    id,
    currentPhase: initialPhase,
    status: "active",
    totalTurns: 0,
    phaseProgress: JSON.stringify(initialProgress),
    insights: JSON.stringify(initialInsights),
    startedAt: now,
    lastActiveAt: now,
  });

  return {
    id,
    currentPhase: initialPhase,
    status: "active",
    totalTurns: 0,
    phaseProgress: initialProgress,
    insights: initialInsights,
    startedAt: now,
    completedAt: null,
    lastActiveAt: now,
  };
};

/**
 * セッションを取得
 */
export const getSession = async (
  id: string
): Promise<CoachingSession | null> => {
  const rows = await db
    .select()
    .from(coachingSessions)
    .where(eq(coachingSessions.id, id));

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    currentPhase: row.currentPhase as CoachingPhase,
    status: row.status as CoachingStatus,
    totalTurns: row.totalTurns,
    phaseProgress: row.phaseProgress
      ? JSON.parse(row.phaseProgress)
      : null,
    insights: row.insights ? JSON.parse(row.insights) : null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    lastActiveAt: row.lastActiveAt,
  };
};

/**
 * アクティブなセッションを取得
 */
export const getActiveSession = async (): Promise<CoachingSession | null> => {
  const rows = await db
    .select()
    .from(coachingSessions)
    .where(eq(coachingSessions.status, "active"))
    .orderBy(desc(coachingSessions.lastActiveAt))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    currentPhase: row.currentPhase as CoachingPhase,
    status: row.status as CoachingStatus,
    totalTurns: row.totalTurns,
    phaseProgress: row.phaseProgress
      ? JSON.parse(row.phaseProgress)
      : null,
    insights: row.insights ? JSON.parse(row.insights) : null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    lastActiveAt: row.lastActiveAt,
  };
};

/**
 * セッションを更新
 */
export const updateSession = async (
  id: string,
  updates: Partial<{
    currentPhase: CoachingPhase;
    status: CoachingStatus;
    totalTurns: number;
    phaseProgress: Record<CoachingPhase, number>;
    insights: CoachingInsights;
    completedAt: number;
  }>
): Promise<CoachingSession | null> => {
  const now = Math.floor(Date.now() / 1000);

  const updateData: Record<string, unknown> = {
    lastActiveAt: now,
  };

  if (updates.currentPhase !== undefined) {
    updateData.currentPhase = updates.currentPhase;
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status;
  }
  if (updates.totalTurns !== undefined) {
    updateData.totalTurns = updates.totalTurns;
  }
  if (updates.phaseProgress !== undefined) {
    updateData.phaseProgress = JSON.stringify(updates.phaseProgress);
  }
  if (updates.insights !== undefined) {
    updateData.insights = JSON.stringify(updates.insights);
  }
  if (updates.completedAt !== undefined) {
    updateData.completedAt = updates.completedAt;
  }

  await db
    .update(coachingSessions)
    .set(updateData)
    .where(eq(coachingSessions.id, id));

  return getSession(id);
};

/**
 * セッションを終了
 */
export const endSession = async (
  id: string,
  status: "completed" | "abandoned" = "completed"
): Promise<CoachingSession | null> => {
  const now = Math.floor(Date.now() / 1000);

  await db
    .update(coachingSessions)
    .set({
      status,
      completedAt: now,
      lastActiveAt: now,
    })
    .where(eq(coachingSessions.id, id));

  return getSession(id);
};

/**
 * メッセージを追加
 */
export const addMessage = async (
  input: AddMessageInput
): Promise<CoachingMessage> => {
  const result = await db
    .insert(coachingMessages)
    .values({
      sessionId: input.sessionId,
      turn: input.turn,
      phase: input.phase,
      role: input.role,
      content: input.content,
      promptType: input.promptType ?? null,
      extractedInsights: input.extractedInsights
        ? JSON.stringify(input.extractedInsights)
        : null,
    })
    .returning();

  const row = result[0];
  return {
    id: row.id,
    sessionId: row.sessionId,
    turn: row.turn,
    phase: row.phase as CoachingPhase,
    role: row.role as "coach" | "user",
    content: row.content,
    promptType: row.promptType,
    extractedInsights: row.extractedInsights
      ? JSON.parse(row.extractedInsights)
      : null,
    createdAt: row.createdAt,
  };
};

/**
 * セッションのメッセージ一覧を取得
 */
export const getMessages = async (
  sessionId: string
): Promise<CoachingMessage[]> => {
  const rows = await db
    .select()
    .from(coachingMessages)
    .where(eq(coachingMessages.sessionId, sessionId))
    .orderBy(coachingMessages.turn, coachingMessages.createdAt);

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    turn: row.turn,
    phase: row.phase as CoachingPhase,
    role: row.role as "coach" | "user",
    content: row.content,
    promptType: row.promptType,
    extractedInsights: row.extractedInsights
      ? JSON.parse(row.extractedInsights)
      : null,
    createdAt: row.createdAt,
  }));
};

/**
 * 過去のセッション一覧を取得
 */
export const getSessionHistory = async (
  limit: number = 10
): Promise<CoachingSession[]> => {
  const rows = await db
    .select()
    .from(coachingSessions)
    .orderBy(desc(coachingSessions.startedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    currentPhase: row.currentPhase as CoachingPhase,
    status: row.status as CoachingStatus,
    totalTurns: row.totalTurns,
    phaseProgress: row.phaseProgress
      ? JSON.parse(row.phaseProgress)
      : null,
    insights: row.insights ? JSON.parse(row.insights) : null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    lastActiveAt: row.lastActiveAt,
  }));
};

/**
 * セッションとメッセージを含む詳細を取得
 */
export const getSessionWithMessages = async (
  id: string
): Promise<{ session: CoachingSession; messages: CoachingMessage[] } | null> => {
  const session = await getSession(id);
  if (!session) {
    return null;
  }

  const messages = await getMessages(id);
  return { session, messages };
};
