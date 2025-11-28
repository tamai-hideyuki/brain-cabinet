import { db } from "../db/client";
import { notes } from "../db/schema";
import { like } from "drizzle-orm";

export const searchNotesInDB = async (query: string) => {
  if (!query) return [];

  return await db
    .select()
    .from(notes)
    .where(like(notes.content, `%${query}%`))
    .all();
};
