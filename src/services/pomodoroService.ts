/**
 * ポモドーロタイマーサービス
 * タイマー操作と状態計算のビジネスロジック
 */

import * as pomodoroRepo from "../repositories/pomodoroRepo";

// 定数
const WORK_DURATION = 25 * 60; // 25分
const BREAK_DURATION = 5 * 60; // 5分

// クライアントに返す状態の型
export type PomodoroStateResponse = {
  isRunning: boolean;
  isBreak: boolean;
  remainingSeconds: number;
  completedSessions: number;
  isNotifying: boolean;
  totalDuration: number;
};

// 履歴の型
export type PomodoroHistory = Record<string, number>;

/**
 * 今日の日付文字列を取得
 */
const getTodayKey = (): string => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

/**
 * 現在の状態を取得（残り時間を計算して返す）
 */
export const getState = async (): Promise<PomodoroStateResponse> => {
  const timerState = await pomodoroRepo.getTimerState();
  const todayKey = getTodayKey();
  const completedSessions = await pomodoroRepo.getSessionCountByDate(todayKey);

  // タイマー状態がない場合は初期状態を返す
  if (!timerState) {
    return {
      isRunning: false,
      isBreak: false,
      remainingSeconds: WORK_DURATION,
      completedSessions,
      isNotifying: false,
      totalDuration: WORK_DURATION,
    };
  }

  // タイマーが実行中でない場合
  if (!timerState.isRunning) {
    const remainingSeconds = timerState.remainingAtStart ??
      (timerState.isBreak ? BREAK_DURATION : WORK_DURATION);

    return {
      isRunning: false,
      isBreak: timerState.isBreak,
      remainingSeconds,
      completedSessions,
      isNotifying: false,
      totalDuration: timerState.totalDuration,
    };
  }

  // タイマーが実行中の場合、経過時間を計算
  const now = Date.now();
  const startedAt = timerState.startedAt ?? now;
  const remainingAtStart = timerState.remainingAtStart ?? timerState.totalDuration;
  const elapsedSeconds = Math.floor((now - startedAt) / 1000);
  const remainingSeconds = Math.max(0, remainingAtStart - elapsedSeconds);

  // タイマーが終了している場合
  if (remainingSeconds <= 0) {
    return {
      isRunning: false,
      isBreak: timerState.isBreak,
      remainingSeconds: 0,
      completedSessions,
      isNotifying: true,
      totalDuration: timerState.totalDuration,
    };
  }

  return {
    isRunning: true,
    isBreak: timerState.isBreak,
    remainingSeconds,
    completedSessions,
    isNotifying: false,
    totalDuration: timerState.totalDuration,
  };
};

/**
 * タイマーを開始
 */
export const start = async (
  remainingSeconds?: number,
  isBreak?: boolean
): Promise<PomodoroStateResponse> => {
  const currentState = await pomodoroRepo.getTimerState();

  const duration = isBreak !== undefined
    ? (isBreak ? BREAK_DURATION : WORK_DURATION)
    : (currentState?.isBreak ? BREAK_DURATION : WORK_DURATION);

  const remaining = remainingSeconds ?? currentState?.remainingAtStart ?? duration;
  const breakMode = isBreak ?? currentState?.isBreak ?? false;

  await pomodoroRepo.updateTimerState({
    isRunning: true,
    isBreak: breakMode,
    startedAt: Date.now(),
    totalDuration: breakMode ? BREAK_DURATION : WORK_DURATION,
    remainingAtStart: remaining,
  });

  return getState();
};

/**
 * タイマーを一時停止
 */
export const pause = async (): Promise<PomodoroStateResponse> => {
  const currentState = await pomodoroRepo.getTimerState();

  if (!currentState || !currentState.isRunning) {
    return getState();
  }

  // 現在の残り時間を計算
  const now = Date.now();
  const startedAt = currentState.startedAt ?? now;
  const remainingAtStart = currentState.remainingAtStart ?? currentState.totalDuration;
  const elapsedSeconds = Math.floor((now - startedAt) / 1000);
  const remainingSeconds = Math.max(0, remainingAtStart - elapsedSeconds);

  await pomodoroRepo.updateTimerState({
    isRunning: false,
    isBreak: currentState.isBreak,
    startedAt: null,
    totalDuration: currentState.totalDuration,
    remainingAtStart: remainingSeconds,
  });

  return getState();
};

/**
 * タイマーをリセット
 */
export const reset = async (): Promise<PomodoroStateResponse> => {
  await pomodoroRepo.updateTimerState({
    isRunning: false,
    isBreak: false,
    startedAt: null,
    totalDuration: WORK_DURATION,
    remainingAtStart: WORK_DURATION,
  });

  return getState();
};

/**
 * セッション完了（通知を閉じて次のセッションへ）
 */
export const complete = async (isBreak: boolean): Promise<PomodoroStateResponse> => {
  const todayKey = getTodayKey();
  const duration = isBreak ? BREAK_DURATION : WORK_DURATION;

  // 作業セッション完了時のみ記録
  if (!isBreak) {
    await pomodoroRepo.recordSession(todayKey, false, duration);
  }

  // 次のフェーズに切り替え
  const nextIsBreak = !isBreak;
  const nextDuration = nextIsBreak ? BREAK_DURATION : WORK_DURATION;

  await pomodoroRepo.updateTimerState({
    isRunning: false,
    isBreak: nextIsBreak,
    startedAt: null,
    totalDuration: nextDuration,
    remainingAtStart: nextDuration,
  });

  return getState();
};

/**
 * セッション履歴を取得（カレンダー表示用）
 */
export const getHistory = async (days: number = 365): Promise<PomodoroHistory> => {
  const sessions = await pomodoroRepo.getSessionHistory(days);

  const history: PomodoroHistory = {};
  for (const session of sessions) {
    history[session.date] = session.count;
  }

  return history;
};
