/**
 * ポモドーロタイマーAPIルート
 */

import { Hono } from "hono";
import * as pomodoroService from "../../services/pomodoroService";
import { logger } from "../../utils/logger";

export const pomodoroRoute = new Hono();

/**
 * GET /api/pomodoro/state - 現在の状態を取得
 */
pomodoroRoute.get("/state", async (c) => {
  try {
    const state = await pomodoroService.getState();
    return c.json(state);
  } catch (e) {
    logger.error({ err: e }, "Failed to get pomodoro state");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * POST /api/pomodoro/start - タイマーを開始
 */
pomodoroRoute.post("/start", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { remainingSeconds, isBreak } = body as {
      remainingSeconds?: number;
      isBreak?: boolean;
    };

    const state = await pomodoroService.start(remainingSeconds, isBreak);
    return c.json(state);
  } catch (e) {
    logger.error({ err: e }, "Failed to start pomodoro");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * POST /api/pomodoro/pause - タイマーを一時停止
 */
pomodoroRoute.post("/pause", async (c) => {
  try {
    const state = await pomodoroService.pause();
    return c.json(state);
  } catch (e) {
    logger.error({ err: e }, "Failed to pause pomodoro");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * POST /api/pomodoro/reset - タイマーをリセット
 */
pomodoroRoute.post("/reset", async (c) => {
  try {
    const state = await pomodoroService.reset();
    return c.json(state);
  } catch (e) {
    logger.error({ err: e }, "Failed to reset pomodoro");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * POST /api/pomodoro/complete - セッション完了（通知を閉じて次へ）
 */
pomodoroRoute.post("/complete", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { isBreak } = body as { isBreak?: boolean };

    if (isBreak === undefined) {
      return c.json({ error: "isBreak is required" }, 400);
    }

    const state = await pomodoroService.complete(isBreak);
    return c.json(state);
  } catch (e) {
    logger.error({ err: e }, "Failed to complete pomodoro session");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GET /api/pomodoro/history - 履歴を取得（カレンダー表示用）
 */
pomodoroRoute.get("/history", async (c) => {
  try {
    const days = parseInt(c.req.query("days") ?? "365", 10);
    const history = await pomodoroService.getHistory(days);
    return c.json(history);
  } catch (e) {
    logger.error({ err: e }, "Failed to get pomodoro history");
    return c.json({ error: (e as Error).message }, 500);
  }
});
