import { db } from "../db/client";
import { noteHistory } from "../db/schema";
import { randomUUID } from "crypto";

export const saveHistory = async (noteId: string, content: string, diff?: string) => {
  const now = Math.floor(Date.now() / 1000);

  await db.insert(noteHistory).values({
    id: randomUUID(),
    noteId,
    content,
    diff,
    createdAt: now,
  });
};
