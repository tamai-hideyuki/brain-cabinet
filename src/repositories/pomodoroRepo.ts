/**
 * ポモドーロタイマーリポジトリ
 * タイマー状態とセッション履歴の永続化
 */

import { db } from "../db/client";
import { pomodoroTimerState, pomodoroSessions } from "../db/schema";
import { eq, sql, desc, gte, and } from "drizzle-orm";

// タイマー状態の型
export type TimerState = {
  id: number;
  isRunning: boolean;
  isBreak: boolean;
  startedAt: number | null;
  totalDuration: number;
  remainingAtStart: number | null;
  description: string | null;
  updatedAt: number;
};

// セッション履歴の型
export type PomodoroSession = {
  id: number;
  date: string;
  completedAt: number;
  duration: number;
  isBreak: boolean;
  description: string | null;
};

// 日付別セッション数の型
export type SessionCount = {
  date: string;
  count: number;
};

/**
 * タイマー状態を取得
 */
export const getTimerState = async (): Promise<TimerState | null> => {
  const rows = await db
    .select()
    .from(pomodoroTimerState)
    .where(eq(pomodoroTimerState.id, 1));

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    isRunning: row.isRunning === 1,
    isBreak: row.isBreak === 1,
    startedAt: row.startedAt,
    totalDuration: row.totalDuration,
    remainingAtStart: row.remainingAtStart,
    description: row.description,
    updatedAt: row.updatedAt,
  };
};

/**
 * タイマー状態を更新（upsert）
 */
export const updateTimerState = async (state: {
  isRunning: boolean;
  isBreak: boolean;
  startedAt: number | null;
  totalDuration: number;
  remainingAtStart: number | null;
  description?: string | null;
}): Promise<TimerState> => {
  const now = Math.floor(Date.now() / 1000);

  // SQLite では INSERT OR REPLACE を使用
  await db.run(sql`
    INSERT OR REPLACE INTO pomodoro_timer_state
    (id, is_running, is_break, started_at, total_duration, remaining_at_start, description, updated_at)
    VALUES (
      1,
      ${state.isRunning ? 1 : 0},
      ${state.isBreak ? 1 : 0},
      ${state.startedAt},
      ${state.totalDuration},
      ${state.remainingAtStart},
      ${state.description ?? null},
      ${now}
    )
  `);

  return {
    id: 1,
    isRunning: state.isRunning,
    isBreak: state.isBreak,
    startedAt: state.startedAt,
    totalDuration: state.totalDuration,
    remainingAtStart: state.remainingAtStart,
    description: state.description ?? null,
    updatedAt: now,
  };
};

/**
 * セッション完了を記録
 */
export const recordSession = async (
  date: string,
  isBreak: boolean,
  duration: number,
  description?: string | null
): Promise<PomodoroSession> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .insert(pomodoroSessions)
    .values({
      date,
      completedAt: now,
      duration,
      isBreak: isBreak ? 1 : 0,
      description: description ?? null,
    })
    .returning();

  const row = result[0];
  return {
    id: row.id,
    date: row.date,
    completedAt: row.completedAt,
    duration: row.duration,
    isBreak: row.isBreak === 1,
    description: row.description,
  };
};

/**
 * 指定日の作業セッション数を取得（休憩は除く）
 */
export const getSessionCountByDate = async (date: string): Promise<number> => {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(pomodoroSessions)
    .where(and(eq(pomodoroSessions.date, date), eq(pomodoroSessions.isBreak, 0)));

  return rows[0]?.count ?? 0;
};

/**
 * 過去N日間のセッション履歴を取得（カレンダー表示用）
 */
export const getSessionHistory = async (days: number): Promise<SessionCount[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const rows = await db
    .select({
      date: pomodoroSessions.date,
      count: sql<number>`count(*)`,
    })
    .from(pomodoroSessions)
    .where(and(
      gte(pomodoroSessions.date, startDateStr),
      eq(pomodoroSessions.isBreak, 0) // 作業セッションのみカウント
    ))
    .groupBy(pomodoroSessions.date)
    .orderBy(desc(pomodoroSessions.date));

  return rows.map((row) => ({
    date: row.date,
    count: row.count,
  }));
};

/**
 * 今日のセッション一覧を取得
 */
export const getTodaySessions = async (): Promise<PomodoroSession[]> => {
  const today = new Date().toISOString().split("T")[0];

  const rows = await db
    .select()
    .from(pomodoroSessions)
    .where(eq(pomodoroSessions.date, today))
    .orderBy(desc(pomodoroSessions.completedAt));

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    completedAt: row.completedAt,
    duration: row.duration,
    isBreak: row.isBreak === 1,
    description: row.description,
  }));
};

/**
 * 指定日のセッション一覧を取得（作業内容詳細表示用）
 */
export const getSessionsByDate = async (date: string): Promise<PomodoroSession[]> => {
  const rows = await db
    .select()
    .from(pomodoroSessions)
    .where(and(eq(pomodoroSessions.date, date), eq(pomodoroSessions.isBreak, 0)))
    .orderBy(desc(pomodoroSessions.completedAt));

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    completedAt: row.completedAt,
    duration: row.duration,
    isBreak: row.isBreak === 1,
    description: row.description,
  }));
};
