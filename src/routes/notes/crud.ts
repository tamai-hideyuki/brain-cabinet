import { Hono } from "hono";
import { getAllNotes, getNoteById, createNote, updateNote, deleteNote, restoreNote, getDeletedNotes } from "../../services/notesService";
import { logger } from "../../utils/logger";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { PERSPECTIVES, Perspective } from "../../db/schema";

export const crudRoute = new Hono();

// GET /api/notes - 一覧取得
crudRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});

// GET /api/notes/deleted - 削除済みノート一覧（:id より前に定義）
crudRoute.get("/deleted", async (c) => {
  try {
    const notes = await getDeletedNotes();
    return c.json({ notes, total: notes.length });
  } catch (e) {
    logger.error({ err: e }, "Failed to get deleted notes");
    return c.json({ error: (e as Error).message }, 500);
  }
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

// DELETE /api/notes/:id - 削除（ソフトデリート）
crudRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const deleted = await deleteNote(id);
    return c.json({ message: "Note deleted (can be restored within 1 hour)", note: deleted });
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to delete note");
    return c.json({ error: (e as Error).message }, 404);
  }
});

// POST /api/notes/:id/restore - 削除済みノートを復元
crudRoute.post("/:id/restore", async (c) => {
  const id = c.req.param("id");
  try {
    const restored = await restoreNote(id);
    return c.json({ message: "Note restored", note: restored });
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to restore note");
    return c.json({ error: (e as Error).message }, 404);
  }
});

// PATCH /api/notes/:id/perspective - 視点タグを更新
crudRoute.patch("/:id/perspective", async (c) => {
  const id = c.req.param("id");
  try {
    const { perspective } = await c.req.json();

    // perspectiveの検証
    if (perspective !== null && !PERSPECTIVES.includes(perspective as Perspective)) {
      return c.json({ error: `Invalid perspective. Must be one of: ${PERSPECTIVES.join(", ")}` }, 400);
    }

    // カラムが存在するか確認
    const hasColumn = await db.get<{ count: number }>(sql`
      SELECT COUNT(*) as count FROM pragma_table_info('notes')
      WHERE name = 'perspective'
    `);

    if (!hasColumn || hasColumn.count === 0) {
      return c.json({ error: "perspective column not found. Please run migration first." }, 400);
    }

    // 更新
    await db.run(sql`
      UPDATE notes
      SET perspective = ${perspective}, updated_at = strftime('%s','now')
      WHERE id = ${id}
    `);

    const note = await getNoteById(id);
    return c.json({ message: "Perspective updated", note });
  } catch (e) {
    logger.error({ err: e, noteId: id }, "Failed to update perspective");
    return c.json({ error: (e as Error).message }, 400);
  }
});
