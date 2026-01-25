import { Hono } from "hono";
import { getAllNotes, getNoteById, createNote, updateNote, deleteNote, restoreNote, getDeletedNotes } from "../../services/notesService";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { PERSPECTIVES, Perspective } from "../../db/schema";
import { ValidationError, ErrorCodes } from "../../utils/errors";

export const crudRoute = new Hono();

// GET /api/notes - 一覧取得
crudRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});

// GET /api/notes/deleted - 削除済みノート一覧（:id より前に定義）
crudRoute.get("/deleted", async (c) => {
  const notes = await getDeletedNotes();
  return c.json({ notes, total: notes.length });
});

// POST /api/notes - 新規作成
crudRoute.post("/", async (c) => {
  const body = await c.req.json();
  const created = await createNote(body.title, body.content);
  return c.json(created, 201);
});

// GET /api/notes/:id - 詳細取得
crudRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const note = await getNoteById(id);
  return c.json(note);
});

// PUT /api/notes/:id - 更新
crudRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const { content, title } = await c.req.json();
  const updated = await updateNote(id, content, title);
  return c.json(updated);
});

// DELETE /api/notes/:id - 削除（ソフトデリート）
crudRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await deleteNote(id);
  return c.json({ message: "Note deleted (can be restored within 1 hour)", note: deleted });
});

// POST /api/notes/:id/restore - 削除済みノートを復元
crudRoute.post("/:id/restore", async (c) => {
  const id = c.req.param("id");
  const restored = await restoreNote(id);
  return c.json({ message: "Note restored", note: restored });
});

// PATCH /api/notes/:id/perspective - 視点タグを更新
crudRoute.patch("/:id/perspective", async (c) => {
  const id = c.req.param("id");
  const { perspective } = await c.req.json();

  // perspectiveの検証
  if (perspective !== null && !PERSPECTIVES.includes(perspective as Perspective)) {
    throw new ValidationError(
      `Invalid perspective. Must be one of: ${PERSPECTIVES.join(", ")}`,
      "perspective",
      ErrorCodes.VALIDATION_INVALID_ENUM
    );
  }

  // カラムが存在するか確認
  const hasColumn = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM pragma_table_info('notes')
    WHERE name = 'perspective'
  `);

  if (!hasColumn || hasColumn.count === 0) {
    throw new ValidationError(
      "perspective column not found. Please run migration first.",
      "perspective",
      ErrorCodes.INTERNAL
    );
  }

  // 更新
  await db.run(sql`
    UPDATE notes
    SET perspective = ${perspective}, updated_at = strftime('%s','now')
    WHERE id = ${id}
  `);

  const note = await getNoteById(id);
  return c.json({ message: "Perspective updated", note });
});
