import { db } from "../../shared/db/client";
import { sql } from "drizzle-orm";
import { tokenize } from "../../shared/utils/tokenizer";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * FTS5用に日本語をtiny-segmenterで形態素解析し、空白区切りの文字列に変換する。
 * これによりFTS5のunicode61トークナイザーが日本語を語単位で索引できる。
 *
 * 例: "転職の判断" → "転職 の 判断"
 */
const tokenizeForFTS = (text: string): string => {
  if (!text) return "";
  return tokenize(text).join(" ");
};

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
    VALUES (
      ${noteId},
      ${tokenizeForFTS(title)},
      ${tokenizeForFTS(content)},
      ${tokenizeForFTS(tagsText)},
      ${tokenizeForFTS(headingsText)}
    )
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
    VALUES (
      ${noteId},
      ${tokenizeForFTS(title)},
      ${tokenizeForFTS(content)},
      ${tokenizeForFTS(tagsText)},
      ${tokenizeForFTS(headingsText)}
    )
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
 * AND結合の結果がこの件数以下なら OR フォールバックする閾値。
 * 多語クエリで AND が厳しすぎる時 (例: 「TDD テスト駆動開発」が1件しか返さない) のみ
 * OR で recall を救うための仕組み。
 */
const AND_FALLBACK_THRESHOLD = 5;

/**
 * FTS5で全文検索（note_idのリストを返す）。
 * AND で十分な件数取れない場合は OR にフォールバックして recall を確保する。
 */
export const searchFTS = async (
  query: string,
  limit = 50
): Promise<{ noteId: string; rank: number }[]> => {
  const andQuery = buildFTSQuery(query, "AND");
  if (!andQuery) return [];

  const andResults = await db.all<{ note_id: string; rank: number }>(sql`
    SELECT note_id, rank
    FROM notes_fts
    WHERE notes_fts MATCH ${andQuery}
    ORDER BY rank
    LIMIT ${limit}
  `);

  // AND で十分なヒットがあればそのまま返す (precision 維持)
  if (andResults.length > AND_FALLBACK_THRESHOLD) {
    return andResults.map((row) => ({ noteId: row.note_id, rank: row.rank }));
  }

  // ヒット数が少ない多語クエリは OR で recall を救う
  const orQuery = buildFTSQuery(query, "OR");
  if (orQuery === andQuery) {
    // 1トークンクエリ等で OR=AND になる場合は AND結果をそのまま返す
    return andResults.map((row) => ({ noteId: row.note_id, rank: row.rank }));
  }

  const orResults = await db.all<{ note_id: string; rank: number }>(sql`
    SELECT note_id, rank
    FROM notes_fts
    WHERE notes_fts MATCH ${orQuery}
    ORDER BY rank
    LIMIT ${limit}
  `);

  return orResults.map((row) => ({ noteId: row.note_id, rank: row.rank }));
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
 * - tiny-segmenterで日本語を形態素解析（「転職の判断」→「転職 の 判断」）
 * - 短すぎるトークン（≤1文字、助詞や記号片）を除外
 * - 各トークンを前方一致検索（*付き）
 * - 特殊文字をエスケープ
 * - FTS演算子（OR, AND, NOT）が明示された場合は順序を保持（後方互換）
 *
 * デフォルトは暗黙AND（precision重視）。多語クエリで結果が極端に少ない場合は
 * searchFTS 側でOR フォールバックする（recall を救う）。
 */
export const buildFTSQuery = (query: string, joinWith: "AND" | "OR" = "AND"): string => {
  const trimmed = query.trim();
  if (!trimmed) return "";

  const FTS_OPERATORS = new Set(["OR", "AND", "NOT"]);

  const sanitized = trimmed
    .replace(/['"(){}[\]*:^~!@#$%&\\/.+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return "";

  // スペース区切りで分割した後、各単語をtiny-segmenterで形態素解析する
  // 例: "転職の判断" → ["転職", "の", "判断"] → 短語フィルタ → ["転職", "判断"]
  const tokens: string[] = [];
  for (const word of sanitized.split(" ")) {
    if (FTS_OPERATORS.has(word.toUpperCase())) {
      tokens.push(word.toUpperCase());
      continue;
    }
    const subTokens = tokenize(word).filter((t) => t.length >= 2);
    tokens.push(...subTokens);
  }

  if (tokens.length === 0) return "";

  // ユーザーが演算子を明示した場合は順序を保持して既存挙動を維持
  const hasExplicitOperator = tokens.some((t) =>
    FTS_OPERATORS.has(t.toUpperCase())
  );
  if (hasExplicitOperator) {
    return tokens
      .map((t) => (FTS_OPERATORS.has(t.toUpperCase()) ? t.toUpperCase() : `${t}*`))
      .join(" ");
  }

  // 演算子なし: 指定された連結子で結合
  // - AND (デフォルト): 全トークンを含むノートに絞る (precision)
  // - OR (フォールバック): いずれかを含むノートを拾い、BM25が順位付け (recall)
  const separator = joinWith === "AND" ? " " : " OR ";
  return tokens.map((t) => `${t}*`).join(separator);
};
