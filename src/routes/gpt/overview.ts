import { Hono } from "hono";
import { getNotesOverviewForGPT } from "../../services/gptService";
import { logger } from "../../utils/logger";

export const overviewRoute = new Hono();

/**
 * GPT向け概要情報
 * GET /api/gpt/overview
 *
 * Brain Cabinet全体の統計情報をGPT向けに提供
 */
overviewRoute.get("/overview", async (c) => {
  try {
    const overview = await getNotesOverviewForGPT();
    return c.json(overview);
  } catch (e) {
    logger.error({ err: e }, "GPT overview fetch failed");
    return c.json({ error: (e as Error).message }, 500);
  }
});
