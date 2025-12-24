import { Hono } from "hono";
import { revertNote } from "../../services/notesService";
import { getNoteHistory, getHistoryHtmlDiff, getNoteFullContext, getNoteWithHistory } from "../../services/historyService";
import { logger } from "../../utils/logger";

export const historyRoute = new Hono();

// GET /api/notes/:id/history - 履歴一覧
historyRoute.get("/:id/history", async (c) => {
  const id = c.req.param("id");
  const history = await getNoteHistory(id);
  return c.json(history);
});

// GET /api/notes/:id/history/:historyId/diff - HTML形式の差分を取得
historyRoute.get("/:id/history/:historyId/diff", async (c) => {
  const noteId = c.req.param("id");
  const historyId = c.req.param("historyId");
  try {
    const diff = await getHistoryHtmlDiff(historyId);
    return c.json(diff);
  } catch (e) {
    logger.error({ err: e, noteId, historyId }, "Failed to get history diff");
    return c.json({ error: (e as Error).message }, 404);
  }
});

// POST /api/notes/:id/revert/:historyId - 履歴に巻き戻し
historyRoute.post("/:id/revert/:historyId", async (c) => {
  const id = c.req.param("id");
  const historyId = c.req.param("historyId");
  try {
    const reverted = await revertNote(id, historyId);
    return c.json(reverted);
  } catch (e) {
    logger.error({ err: e, noteId: id, historyId }, "Failed to revert note");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// GET /api/notes/:id/with-history - 軽量版: ノート + 最新N件の履歴
historyRoute.get("/:id/with-history", async (c) => {
  const id = c.req.param("id");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 3;

  try {
    const result = await getNoteWithHistory(id, limit);
    return c.json(result);
  } catch (e) {
    logger.error({ err: e, noteId: id, limit }, "Failed to get note with history");
    return c.json({ error: (e as Error).message }, 404);
  }
});

// GET /api/notes/:id/full-context - GPT向け: ノート + 全履歴 + 差分を一括取得
historyRoute.get("/:id/full-context", async (c) => {
  const id = c.req.param("id");
  try {
    const context = await getNoteFullContext(id);
    return c.json(context);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to get full context");
    return c.json({ error: (e as Error).message }, 404);
  }
});
