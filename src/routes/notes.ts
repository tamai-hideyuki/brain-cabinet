import { Hono } from "hono";
import { getAllNotes, updateNote, revertNote } from "../services/notesService";
import { getNoteHistory, getHistoryHtmlDiff, getNoteFullContext, getNoteWithHistory } from "../services/historyService";

export const notesRoute = new Hono();

notesRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});

notesRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const { content } = await c.req.json();

  const updated = await updateNote(id, content);
  return c.json(updated);
});

notesRoute.get("/:id/history", async (c) => {
  const id = c.req.param("id");
  const history = await getNoteHistory(id);
  return c.json(history);
});

// HTML形式の差分を取得
notesRoute.get("/:id/history/:historyId/diff", async (c) => {
  const historyId = c.req.param("historyId");
  try {
    const diff = await getHistoryHtmlDiff(historyId);
    return c.json(diff);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 404);
  }
});

// 履歴に巻き戻し
notesRoute.post("/:id/revert/:historyId", async (c) => {
  const id = c.req.param("id");
  const historyId = c.req.param("historyId");
  try {
    const reverted = await revertNote(id, historyId);
    return c.json(reverted);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

// 軽量版: ノート + 最新N件の履歴
notesRoute.get("/:id/with-history", async (c) => {
  const id = c.req.param("id");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 3;

  try {
    const result = await getNoteWithHistory(id, limit);
    return c.json(result);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 404);
  }
});

// GPT向け: ノート + 全履歴 + 差分を一括取得
notesRoute.get("/:id/full-context", async (c) => {
  const id = c.req.param("id");
  try {
    const context = await getNoteFullContext(id);
    return c.json(context);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 404);
  }
});
