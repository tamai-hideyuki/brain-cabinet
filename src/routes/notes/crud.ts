import { Hono } from "hono";
import { getAllNotes, getNoteById, createNote, updateNote, deleteNote } from "../../services/notesService";
import { logger } from "../../utils/logger";

export const crudRoute = new Hono();

// GET /api/notes - 一覧取得
crudRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});

// POST /api/notes - 新規作成
crudRoute.post("/", async (c) => {
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
crudRoute.get("/:id", async (c) => {
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
crudRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const { content, title } = await c.req.json();
    const updated = await updateNote(id, content, title);
    return c.json(updated);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to update note");
    return c.json({ error: (e as Error).message }, 400);
  }
});

// DELETE /api/notes/:id - 削除
crudRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const deleted = await deleteNote(id);
    return c.json({ message: "Note deleted", note: deleted });
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to delete note");
    return c.json({ error: (e as Error).message }, 404);
  }
});
