/**
 * 体調記録APIルート
 */

import { Hono } from "hono";
import * as conditionService from "./service";
import { logger } from "../../shared/utils/logger";
import { CONDITION_LABELS } from "../../shared/db/schema";

export const conditionRoute = new Hono();

/**
 * GET /api/condition/sensor - センサー接続チェック
 */
conditionRoute.get("/sensor", async (c) => {
  try {
    const result = await conditionService.checkSensor();
    return c.json(result);
  } catch (e) {
    logger.error({ err: e }, "Failed to check sensor");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * POST /api/condition - 体調を記録
 */
conditionRoute.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { label } = body as { label: string };

    if (!label || !CONDITION_LABELS.includes(label as typeof CONDITION_LABELS[number])) {
      return c.json({ error: `Invalid label. Must be one of: ${CONDITION_LABELS.join(", ")}` }, 400);
    }

    const log = await conditionService.record(label);
    return c.json(log);
  } catch (e) {
    logger.error({ err: e }, "Failed to record condition");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GET /api/condition/today - 今日の体調ログ
 */
conditionRoute.get("/today", async (c) => {
  try {
    const logs = await conditionService.getToday();
    return c.json(logs);
  } catch (e) {
    logger.error({ err: e }, "Failed to get today's condition logs");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GET /api/condition/recent - 直近の体調ログ
 */
conditionRoute.get("/recent", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") ?? "50", 10);
    const logs = await conditionService.getRecent(limit);
    return c.json(logs);
  } catch (e) {
    logger.error({ err: e }, "Failed to get recent condition logs");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GET /api/condition/date/:date - 指定日の体調ログ
 */
conditionRoute.get("/date/:date", async (c) => {
  try {
    const date = c.req.param("date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
    }

    const logs = await conditionService.getByDate(date);
    return c.json(logs);
  } catch (e) {
    logger.error({ err: e }, "Failed to get condition logs by date");
    return c.json({ error: (e as Error).message }, 500);
  }
});
