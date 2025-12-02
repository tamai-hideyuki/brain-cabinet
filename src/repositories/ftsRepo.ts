import { db } from "../db/client";
import { sql } from "drizzle-orm";

/**
 * FTS5テーブルにノートを追加
 */
export const insertFTS = async (
  noteId: string,
  title: string,
  content: string,
  tags: string | null,
  headings: string | null
) => {
  // JSON配列を検索用テキストに変換
  const tagsText = parseJsonToText(tags);
  const headingsText = parseJsonToText(headings);

  await db.run(sql`
    INSERT INTO notes_fts (note_id, title, content, tags, headings)
    VALUES (${noteId}, ${title}, ${content}, ${tagsText}, ${headingsText})
  `);
};

/**
 * FTS5テーブルのノートを更新（DELETE + INSERT）
 */
export const updateFTS = async (
  noteId: string,
  title: string,
  content: string,
  tags: string | null,
  headings: string | null
) => {
  await deleteFTS(noteId);
  await insertFTS(noteId, title, content, tags, headings);
};

/**
 * FTS5テーブルからノートを削除
 */
export const deleteFTS = async (noteId: string) => {
  await db.run(sql`
    DELETE FROM notes_fts WHERE note_id = ${noteId}
  `);
};

/**
 * FTS5で全文検索（note_idのリストを返す）
 */
export const searchFTS = async (
  query: string,
  limit = 50
): Promise<{ noteId: string; rank: number }[]> => {
  // クエリを FTS5 用に変換（各トークンに * を付けて前方一致）
  const ftsQuery = buildFTSQuery(query);

  if (!ftsQuery) {
    return [];
  }

  const result = await db.all<{ note_id: string; rank: number }>(sql`
    SELECT note_id, rank
    FROM notes_fts
    WHERE notes_fts MATCH ${ftsQuery}
    ORDER BY rank
    LIMIT ${limit}
  `);

  return result.map((row) => ({
    noteId: row.note_id,
    rank: row.rank,
  }));
};

/**
 * FTS5テーブルを再構築（全データを再インデックス）
 */
export const rebuildFTS = async (
  notes: Array<{
    id: string;
    title: string;
    content: string;
    tags: string | null;
    headings: string | null;
  }>
) => {
  // 全削除
  await db.run(sql`DELETE FROM notes_fts`);

  // 全追加
  for (const note of notes) {
    await insertFTS(note.id, note.title, note.content, note.tags, note.headings);
  }
};

/**
 * FTS5テーブルが存在するかチェック
 */
export const checkFTSTableExists = async (): Promise<boolean> => {
  try {
    const result = await db.all<{ name: string }>(sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='notes_fts'
    `);
    return result.length > 0;
  } catch {
    return false;
  }
};

/**
 * FTS5テーブルを作成
 */
export const createFTSTable = async () => {
  await db.run(sql`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      title,
      content,
      tags,
      headings
    )
  `);
};

// ヘルパー関数

/**
 * JSON配列を検索用テキストに変換
 * e.g. '["TypeScript","API"]' → 'TypeScript API'
 */
const parseJsonToText = (jsonStr: string | null): string => {
  if (!jsonStr) return "";
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.join(" ");
    }
    return "";
  } catch {
    return "";
  }
};

/**
 * 検索クエリをFTS5形式に変換
 * - 各単語を前方一致検索（*付き）
 * - 特殊文字をエスケープ
 */
const buildFTSQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) return "";

  // 特殊文字を除去/エスケープ
  const sanitized = trimmed
    .replace(/['"(){}[\]*:^~!@#$%&\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "";

  // 各単語に前方一致(*) を付与し、AND で結合
  const tokens = sanitized.split(" ").filter((t) => t.length > 0);

  if (tokens.length === 0) return "";

  // FTS5 のクエリ形式: "token1*" AND "token2*"
  // または prefix 検索: token1* token2* (暗黙のAND)
  return tokens.map((t) => `${t}*`).join(" ");
};
