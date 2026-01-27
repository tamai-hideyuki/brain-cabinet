import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { notes } from "../../db/schema";

/**
 * データベース接続を確認するための簡単なクエリ
 */
export const checkConnection = async (): Promise<void> => {
  await db.select({ count: sql<number>`1` }).from(notes).limit(1);
};

/**
 * ノートの総数を取得
 */
export const countNotes = async (): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notes);
  return result[0]?.count ?? 0;
};
