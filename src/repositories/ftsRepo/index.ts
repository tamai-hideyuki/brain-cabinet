import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
 * FTS5テーブルにノートを追加（トランザクション対応版）
 */
export const insertFTSRaw = async (
  tx: Transaction,
  noteId: string,
  title: string,
  content: string,
  tags: string | null,
  headings: string | null
) => {
  const tagsText = parseJsonToText(tags);
  const headingsText = parseJsonToText(headings);

  await tx.run(sql`
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
 * FTS5テーブルのノートを更新（トランザクション対応版）
 */
export const updateFTSRaw = async (
  tx: Transaction,
  noteId: string,
  title: string,
  content: string,
  tags: string | null,
  headings: string | null
) => {
  await deleteFTSRaw(tx, noteId);
  await insertFTSRaw(tx, noteId, title, content, tags, headings);
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
 * FTS5テーブルからノートを削除（トランザクション対応版）
 */
export const deleteFTSRaw = async (tx: Transaction, noteId: string) => {
  await tx.run(sql`
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
 * テーブルが存在しない場合は作成してから再構築
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
  // テーブルが存在しない場合は作成
  const exists = await checkFTSTableExists();
  if (!exists) {
    await createFTSTable();
  }

  await db.transaction(async (tx) => {
    // 全削除
    await tx.run(sql`DELETE FROM notes_fts`);

    // 全追加
    for (const note of notes) {
      await insertFTSRaw(tx, note.id, note.title, note.content, note.tags, note.headings);
    }
  });
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
export const parseJsonToText = (jsonStr: string | null): string => {
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
 * - FTS演算子（OR, AND, NOT）は特別扱い
 */
export const buildFTSQuery = (query: string): string => {
  const trimmed = query.trim();
  if (!trimmed) return "";

  // FTS5の演算子（大文字小文字を区別しない）
  const FTS_OPERATORS = new Set(["OR", "AND", "NOT"]);

  // 特殊文字を除去/エスケープ
  // FTS5がトークン区切りとして扱う文字（/ - . +など）も除去
  const sanitized = trimmed
    .replace(/['"(){}[\]*:^~!@#$%&\\/.+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "";

  // 各単語に前方一致(*) を付与し、AND で結合
  const tokens = sanitized.split(" ").filter((t) => t.length > 0);

  if (tokens.length === 0) return "";

  // FTS5 のクエリ形式: "token1*" AND "token2*"
  // または prefix 検索: token1* token2* (暗黙のAND)
  // FTS演算子はそのまま保持（*を付けない）
  return tokens
    .map((t) => {
      if (FTS_OPERATORS.has(t.toUpperCase())) {
        return t.toUpperCase(); // 演算子は大文字で返す
      }
      return `${t}*`;
    })
    .join(" ");
};
