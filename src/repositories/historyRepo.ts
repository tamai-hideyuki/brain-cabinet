import { db } from "../db/client";
import { noteHistory } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import type { InsertHistoryData } from "../types/note";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const insertHistory = async (data: InsertHistoryData) => {
  return await db.insert(noteHistory).values(data);
};

export const findHistoryByNoteId = async (
  noteId: string,
  options?: { limit?: number; offset?: number }
) => {
  const limit = options?.limit ?? 1000; // デフォルトは実質無制限
  const offset = options?.offset ?? 0;

  return await db
    .select()
    .from(noteHistory)
    .where(eq(noteHistory.noteId, noteId))
    .orderBy(desc(noteHistory.createdAt))
    .limit(limit)
    .offset(offset);
};

export const countHistoryByNoteId = async (noteId: string): Promise<number> => {
  const result = await db
    .select()
    .from(noteHistory)
    .where(eq(noteHistory.noteId, noteId));
  return result.length;
};

export const findHistoryById = async (historyId: string) => {
  const result = await db
    .select()
    .from(noteHistory)
    .where(eq(noteHistory.id, historyId))
    .limit(1);
  return result[0] ?? null;
};

/**
 * 特定ノートの履歴を全削除（トランザクション対応）
 */
export const deleteHistoryByNoteIdRaw = async (
  tx: Transaction,
  noteId: string
) => {
  await tx.delete(noteHistory).where(eq(noteHistory.noteId, noteId));
};
