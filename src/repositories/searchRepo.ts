import { db } from "../db/client";
import { notes } from "../db/schema";
import { sql, desc } from "drizzle-orm";

export const searchNotesInDB = async (query: string) => {
  const q = query.trim();
  if (!q) return [];

  const keyword = `%${q}%`;

  return await db
    .select()
    .from(notes)
    .where(
      sql`${notes.title} LIKE ${keyword} OR ${notes.content} LIKE ${keyword}`
    )
    .orderBy(desc(notes.updatedAt));
};
