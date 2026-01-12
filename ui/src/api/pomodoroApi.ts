/**
 * ポモドーロタイマーAPI クライアント
 */

import { fetchWithAuth } from "./client";

// 状態の型
export type PomodoroState = {
  isRunning: boolean;
  isBreak: boolean;
  remainingSeconds: number;
  completedSessions: number;
  isNotifying: boolean;
  totalDuration: number;
};

// 履歴の型（日付 -> セッション数）
export type PomodoroHistory = Record<string, number>;

const API_BASE = "/api/pomodoro";

/**
 * 現在の状態を取得
 */
export const getState = async (): Promise<PomodoroState> => {
  const res = await fetchWithAuth(`${API_BASE}/state`);
  if (!res.ok) {
    throw new Error("Failed to fetch pomodoro state");
  }
  return res.json();
};

/**
 * タイマーを開始
 */
export const start = async (
  remainingSeconds?: number,
  isBreak?: boolean
): Promise<PomodoroState> => {
  const res = await fetchWithAuth(`${API_BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ remainingSeconds, isBreak }),
  });
  if (!res.ok) {
    throw new Error("Failed to start pomodoro");
  }
  return res.json();
};

/**
 * タイマーを一時停止
 */
export const pause = async (): Promise<PomodoroState> => {
  const res = await fetchWithAuth(`${API_BASE}/pause`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to pause pomodoro");
  }
  return res.json();
};

/**
 * タイマーをリセット
 */
export const reset = async (): Promise<PomodoroState> => {
  const res = await fetchWithAuth(`${API_BASE}/reset`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to reset pomodoro");
  }
  return res.json();
};

/**
 * セッション完了
 */
export const complete = async (isBreak: boolean): Promise<PomodoroState> => {
  const res = await fetchWithAuth(`${API_BASE}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isBreak }),
  });
  if (!res.ok) {
    throw new Error("Failed to complete pomodoro session");
  }
  return res.json();
};

/**
 * 履歴を取得
 */
export const getHistory = async (days: number = 365): Promise<PomodoroHistory> => {
  const res = await fetchWithAuth(`${API_BASE}/history?days=${days}`);
  if (!res.ok) {
    throw new Error("Failed to fetch pomodoro history");
  }
  return res.json();
};
