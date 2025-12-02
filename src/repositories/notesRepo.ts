import { db } from "../db/client";
import { notes } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { extractMetadata } from "../utils/metadata";
import { insertFTS, updateFTS, deleteFTS } from "./ftsRepo";

export const findAllNotes = async () => {
  return await db.select().from(notes);
};

export const findNoteById = async (id: string) => {
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result[0] ?? null;
};

export const createNoteInDB = async (title: string, content: string) => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const metadata = extractMetadata(content, title);

  const tagsJson = JSON.stringify(metadata.tags);
  const headingsJson = JSON.stringify(metadata.headings);

  await db.insert(notes).values({
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

  // FTS5に同期
  await insertFTS(id, title, content, tagsJson, headingsJson);

  return await findNoteById(id);
};

export const updateNoteInDB = async (id: string, newContent: string) => {
  const now = Math.floor(Date.now() / 1000);
  const note = await findNoteById(id);
  if (!note) return null;

  const metadata = extractMetadata(newContent, note.title);
  const tagsJson = JSON.stringify(metadata.tags);
  const headingsJson = JSON.stringify(metadata.headings);

  await db
    .update(notes)
    .set({
      content: newContent,
      tags: tagsJson,
      category: metadata.category,
      headings: headingsJson,
      updatedAt: now,
    })
    .where(eq(notes.id, id));

  // FTS5に同期
  await updateFTS(id, note.title, newContent, tagsJson, headingsJson);

  return await findNoteById(id);
};

export const deleteNoteInDB = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) return null;

  await db.delete(notes).where(eq(notes.id, id));

  // FTS5から削除
  await deleteFTS(id);

  return note;
};
