import { db } from "../db/client";
import { notes } from "../db/schema";
import { eq } from "drizzle-orm";

export const findAllNotes = async () => {
  return await db.select().from(notes);
};

export const findNoteById = async (id: string) => {
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result[0] ?? null;
};

export const updateNoteInDB = async (id: string, newContent: string) => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(notes)
    .set({ content: newContent, updatedAt: now })
    .where(eq(notes.id, id));
  return await findNoteById(id);
};
