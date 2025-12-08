import { db } from "../db/client";
import { notes } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { extractMetadata } from "../utils/metadata";
import { insertFTSRaw, updateFTSRaw, deleteFTSRaw } from "./ftsRepo";

export const findAllNotes = async () => {
  return await db.select().from(notes);
};

export const findNoteById = async (id: string) => {
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result[0] ?? null;
};

/**
 * ノートを作成（トランザクション内でnotes + FTS5を同期）
 */
export const createNoteInDB = async (title: string, content: string) => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const metadata = extractMetadata(content, title);

  const tagsJson = JSON.stringify(metadata.tags);
  const headingsJson = JSON.stringify(metadata.headings);

  // トランザクションでnotes挿入とFTS5挿入を原子的に実行
  await db.transaction(async (tx) => {
    await tx.insert(notes).values({
      id,
      title,
      path: `api-created/${title}.md`,
      content,
      tags: tagsJson,
      category: metadata.category,
      headings: headingsJson,
      createdAt: now,
      updatedAt: now,
    });

    // FTS5に同期（トランザクション内）
    await insertFTSRaw(tx, id, title, content, tagsJson, headingsJson);
  });

  return await findNoteById(id);
};

/**
 * ノートを更新（トランザクション内でnotes + FTS5を同期）
 */
export const updateNoteInDB = async (id: string, newContent: string, newTitle?: string) => {
  const now = Math.floor(Date.now() / 1000);
  const note = await findNoteById(id);
  if (!note) return null;

  const title = newTitle ?? note.title;
  const metadata = extractMetadata(newContent, title);
  const tagsJson = JSON.stringify(metadata.tags);
  const headingsJson = JSON.stringify(metadata.headings);

  // トランザクションでnotes更新とFTS5更新を原子的に実行
  await db.transaction(async (tx) => {
    await tx
      .update(notes)
      .set({
        title,
        content: newContent,
        tags: tagsJson,
        category: metadata.category,
        headings: headingsJson,
        updatedAt: now,
      })
      .where(eq(notes.id, id));

    // FTS5に同期（トランザクション内）
    await updateFTSRaw(tx, id, title, newContent, tagsJson, headingsJson);
  });

  return await findNoteById(id);
};

/**
 * ノートを削除（トランザクション内でnotes + FTS5を同期）
 */
export const deleteNoteInDB = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) return null;

  // トランザクションでnotes削除とFTS5削除を原子的に実行
  await db.transaction(async (tx) => {
    await tx.delete(notes).where(eq(notes.id, id));

    // FTS5から削除（トランザクション内）
    await deleteFTSRaw(tx, id);
  });

  return note;
};
