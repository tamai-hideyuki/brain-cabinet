import { db } from "../db/client";
import { notes } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { extractMetadata } from "../utils/metadata";

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

  await db.insert(notes).values({
    id,
    title,
    path: `api-created/${title}.md`,
    content,
    tags: JSON.stringify(metadata.tags),
    category: metadata.category,
    headings: JSON.stringify(metadata.headings),
    createdAt: now,
    updatedAt: now,
  });

  return await findNoteById(id);
};

export const updateNoteInDB = async (id: string, newContent: string) => {
  const now = Math.floor(Date.now() / 1000);
  const note = await findNoteById(id);
  if (!note) return null;

  const metadata = extractMetadata(newContent, note.title);

  await db
    .update(notes)
    .set({
      content: newContent,
      tags: JSON.stringify(metadata.tags),
      category: metadata.category,
      headings: JSON.stringify(metadata.headings),
      updatedAt: now,
    })
    .where(eq(notes.id, id));
  return await findNoteById(id);
};

export const deleteNoteInDB = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) return null;

  await db.delete(notes).where(eq(notes.id, id));
  return note;
};
