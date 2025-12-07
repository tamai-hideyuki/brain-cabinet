/**
 * Insight API Routes
 *
 * PTM MetaState の Lite/Full 版を提供
 * GPT が直接参照できる統合エンドポイント
 */

import { Hono } from "hono";
import { generateMetaStateLite, generateMetaStateFull } from "../../services/ptm/engine";
import { logger } from "../../utils/logger";

export const insightRoute = new Hono();

/**
 * GET /api/insight/lite
 * GPT用・簡潔版 - 今日の状態と助言
 */
insightRoute.get("/lite", async (c) => {
  try {
    const state = await generateMetaStateLite();
    return c.json(state);
  } catch (error) {
    logger.error({ error }, "[Insight] Failed to generate lite state");
    return c.json({ error: "Failed to generate insight" }, 500);
  }
});

/**
 * GET /api/insight/full
 * 研究モード・全データ版
 */
insightRoute.get("/full", async (c) => {
  try {
    const state = await generateMetaStateFull();
    return c.json(state);
  } catch (error) {
    logger.error({ error }, "[Insight] Failed to generate full state");
    return c.json({ error: "Failed to generate insight" }, 500);
  }
});

/**
 * GET /api/insight/coach
 * 今日の助言のみ
 */
insightRoute.get("/coach", async (c) => {
  try {
    const state = await generateMetaStateLite();
    return c.json({
      date: state.date,
      mode: state.mode,
      season: state.season,
      state: state.state,
      coach: state.coach,
    });
  } catch (error) {
    logger.error({ error }, "[Insight] Failed to generate coach advice");
    return c.json({ error: "Failed to generate advice" }, 500);
  }
});
