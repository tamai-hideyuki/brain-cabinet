import { db } from "../db/client";
import { notes, Category } from "../db/schema";
import { sql, desc } from "drizzle-orm";

export interface SearchOptions {
  category?: Category;
  tags?: string[];
}

export const searchNotesInDB = async (query: string, options?: SearchOptions) => {
  const q = query.trim();
  if (!q) return [];

  const keyword = `%${q}%`;

  // 基本の検索条件
  let whereClause = sql`(${notes.title} LIKE ${keyword} OR ${notes.content} LIKE ${keyword})`;

  // カテゴリフィルター
  if (options?.category) {
    whereClause = sql`${whereClause} AND ${notes.category} = ${options.category}`;
  }

  // タグフィルター（JSON配列内に含まれるか）
  if (options?.tags && options.tags.length > 0) {
    for (const tag of options.tags) {
      // JSON配列内のタグを検索（部分一致）
      whereClause = sql`${whereClause} AND ${notes.tags} LIKE ${"%" + tag + "%"}`;
    }
  }

  return await db
    .select()
    .from(notes)
    .where(whereClause)
    .orderBy(desc(notes.updatedAt));
};
