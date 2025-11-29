import { db } from "../db/client";
import { noteHistory } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const insertHistory = async (data: any) => {
  return await db.insert(noteHistory).values(data);
};

export const findHistoryByNoteId = async (noteId: string) => {
  return await db
    .select()
    .from(noteHistory)
    .where(eq(noteHistory.noteId, noteId))
    .orderBy(desc(noteHistory.createdAt));
};

export const findHistoryById = async (historyId: string) => {
  const result = await db
    .select()
    .from(noteHistory)
    .where(eq(noteHistory.id, historyId))
    .limit(1);
  return result[0] ?? null;
};
