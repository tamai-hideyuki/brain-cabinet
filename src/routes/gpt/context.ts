import { Hono } from "hono";
import { getContextForGPT } from "../../services/gptService";
import { logger } from "../../utils/logger";

export const contextRoute = new Hono();

/**
 * GPT向けコンテキスト取得
 * GET /api/gpt/notes/:id/context
 *
 * Query params:
 * - full: 全文を含める（true/false、デフォルト: true）
 * - history: 履歴を含める（true/false、デフォルト: true）
 * - historyLimit: 履歴件数制限（デフォルト: 3）
 * - outline: アウトラインを含める（true/false、デフォルト: true）
 * - bullets: 箇条書きを含める（true/false、デフォルト: false）
 */
contextRoute.get("/notes/:id/context", async (c) => {
  const id = c.req.param("id");

  const includeFullContent = c.req.query("full") !== "false";
  const includeHistory = c.req.query("history") !== "false";
  const historyLimitParam = c.req.query("historyLimit");
  const historyLimit = historyLimitParam ? parseInt(historyLimitParam, 10) : 3;
  const includeOutline = c.req.query("outline") !== "false";
  const includeBulletPoints = c.req.query("bullets") === "true";

  try {
    const context = await getContextForGPT(id, {
      includeFullContent,
      includeHistory,
      historyLimit,
      includeOutline,
      includeBulletPoints,
    });
    return c.json(context);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "GPT context fetch failed");
    return c.json({ error: (e as Error).message }, 404);
  }
});
