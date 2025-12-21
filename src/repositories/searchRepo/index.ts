import { db } from "../../db/client";
import { notes, Category } from "../../db/schema";
import { sql, desc, inArray } from "drizzle-orm";
import { searchFTS } from "../ftsRepo";

export interface SearchOptions {
  category?: Category;
  tags?: string[];
  useFTS?: boolean; // FTS5を使用するかどうか（デフォルト: true）
}

/**
 * FTS5を使用した高速検索
 */
export const searchNotesInDB = async (query: string, options?: SearchOptions) => {
  const q = query.trim();
  if (!q) return [];

  const useFTS = options?.useFTS !== false;

  if (useFTS) {
    // FTS5で検索してnote_idを取得
    const ftsResults = await searchFTS(q);

    if (ftsResults.length === 0) {
      // FTS5でヒットしない場合はLIKE検索にフォールバック
      return await searchNotesWithLike(q, options);
    }

    const noteIds = ftsResults.map((r) => r.noteId);

    // note_idでノートを取得
    let result = await db
      .select()
      .from(notes)
      .where(inArray(notes.id, noteIds));

    // カテゴリフィルター
    if (options?.category) {
      result = result.filter((note) => note.category === options.category);
    }

    // タグフィルター
    if (options?.tags && options.tags.length > 0) {
      result = result.filter((note) => {
        if (!note.tags) return false;
        const noteTags = note.tags.toLowerCase();
        return options.tags!.every((tag) => noteTags.includes(tag.toLowerCase()));
      });
    }

    // FTSのrank順にソート（rankが低いほど関連度が高い）
    const rankMap = new Map(ftsResults.map((r) => [r.noteId, r.rank]));
    result.sort((a, b) => (rankMap.get(a.id) ?? 0) - (rankMap.get(b.id) ?? 0));

    return result;
  }

  // FTS未使用の場合はLIKE検索
  return await searchNotesWithLike(q, options);
};

/**
 * 従来のLIKE検索（フォールバック用）
 */
export const searchNotesWithLike = async (query: string, options?: SearchOptions) => {
  const keyword = `%${query}%`;

  // 基本の検索条件
  let whereClause = sql`(${notes.title} LIKE ${keyword} OR ${notes.content} LIKE ${keyword})`;

  // カテゴリフィルター
  if (options?.category) {
    whereClause = sql`${whereClause} AND ${notes.category} = ${options.category}`;
  }

  // タグフィルター（JSON配列内に含まれるか）
  if (options?.tags && options.tags.length > 0) {
    for (const tag of options.tags) {
      whereClause = sql`${whereClause} AND ${notes.tags} LIKE ${"%" + tag + "%"}`;
    }
  }

  return await db
    .select()
    .from(notes)
    .where(whereClause)
    .orderBy(desc(notes.updatedAt));
};
