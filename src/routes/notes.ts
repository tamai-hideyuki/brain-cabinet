import { Hono } from "hono";
import { getAllNotes, getNoteById, createNote, updateNote, deleteNote, revertNote } from "../services/notesService";
import { getNoteHistory, getHistoryHtmlDiff, getNoteFullContext, getNoteWithHistory } from "../services/historyService";
import { logger } from "../utils/logger";

export const notesRoute = new Hono();

// GET /api/notes - 一覧取得
notesRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});

// POST /api/notes - 新規作成
notesRoute.post("/", async (c) => {
  let title: string | undefined;
  try {
    const body = await c.req.json();
    title = body.title;
    const created = await createNote(body.title, body.content);
    return c.json(created, 201);
  } catch (e) {
    logger.error({ err: e, title }, "Failed to create note");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// GET /api/notes/:id - 詳細取得
notesRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const note = await getNoteById(id);
    return c.json(note);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to get note");
    return c.json({ error: (e as Error).message }, 404);
  }
});

// PUT /api/notes/:id - 更新
notesRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { content } = await c.req.json();
    const updated = await updateNote(id, content);
    return c.json(updated);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to update note");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// DELETE /api/notes/:id - 削除
notesRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const deleted = await deleteNote(id);
    return c.json({ message: "Note deleted", note: deleted });
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to delete note");
    return c.json({ error: (e as Error).message }, 404);
  }
});

notesRoute.get("/:id/history", async (c) => {
  const id = c.req.param("id");
  const history = await getNoteHistory(id);
  return c.json(history);
});

// HTML形式の差分を取得
notesRoute.get("/:id/history/:historyId/diff", async (c) => {
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

// 履歴に巻き戻し
notesRoute.post("/:id/revert/:historyId", async (c) => {
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

// 軽量版: ノート + 最新N件の履歴
notesRoute.get("/:id/with-history", async (c) => {
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

// GPT向け: ノート + 全履歴 + 差分を一括取得
notesRoute.get("/:id/full-context", async (c) => {
  const id = c.req.param("id");
  try {
    const context = await getNoteFullContext(id);
    return c.json(context);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to get full context");
    return c.json({ error: (e as Error).message }, 404);
  }
});
