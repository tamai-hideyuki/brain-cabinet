import { db } from "../db/client";
import { sql } from "drizzle-orm";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMENSIONS = 1536;

/**
 * Embeddingを保存
 */
export const saveEmbedding = async (
  noteId: string,
  embedding: number[],
  model = DEFAULT_MODEL
) => {
  const now = Math.floor(Date.now() / 1000);
  const embeddingBlob = float32ArrayToBuffer(embedding);

  // UPSERT（存在すれば更新、なければ挿入）
  await db.run(sql`
    INSERT INTO note_embeddings (note_id, embedding, model, dimensions, created_at, updated_at)
    VALUES (${noteId}, ${embeddingBlob}, ${model}, ${embedding.length}, ${now}, ${now})
    ON CONFLICT(note_id) DO UPDATE SET
      embedding = ${embeddingBlob},
      model = ${model},
      dimensions = ${embedding.length},
      updated_at = ${now}
  `);
};

/**
 * Embeddingを取得
 */
export const getEmbedding = async (noteId: string): Promise<number[] | null> => {
  const result = await db.all<{ embedding: Buffer }>(sql`
    SELECT embedding FROM note_embeddings WHERE note_id = ${noteId}
  `);

  if (result.length === 0) return null;
  return bufferToFloat32Array(result[0].embedding);
};

/**
 * Embeddingを削除
 */
export const deleteEmbedding = async (noteId: string) => {
  await db.run(sql`DELETE FROM note_embeddings WHERE note_id = ${noteId}`);
};

/**
 * 全Embeddingを取得（類似度検索用）
 */
export const getAllEmbeddings = async (): Promise<
  Array<{ noteId: string; embedding: number[] }>
> => {
  const result = await db.all<{ note_id: string; embedding: Buffer }>(sql`
    SELECT note_id, embedding FROM note_embeddings
  `);

  return result.map((row) => ({
    noteId: row.note_id,
    embedding: bufferToFloat32Array(row.embedding),
  }));
};

/**
 * Embeddingが存在するか確認
 */
export const hasEmbedding = async (noteId: string): Promise<boolean> => {
  const result = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM note_embeddings WHERE note_id = ${noteId}
  `);
  return result[0]?.count > 0;
};

/**
 * Embeddingテーブルを作成
 */
export const createEmbeddingTable = async () => {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS note_embeddings (
      note_id TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
      dimensions INTEGER NOT NULL DEFAULT 1536,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);
};

/**
 * Embeddingテーブルが存在するか確認
 */
export const checkEmbeddingTableExists = async (): Promise<boolean> => {
  try {
    const result = await db.all<{ name: string }>(sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='note_embeddings'
    `);
    return result.length > 0;
  } catch {
    return false;
  }
};

/**
 * Embedding済みノート数を取得
 */
export const countEmbeddings = async (): Promise<number> => {
  const result = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM note_embeddings
  `);
  return result[0]?.count ?? 0;
};

// ヘルパー関数

/**
 * Float32配列をBufferに変換
 */
const float32ArrayToBuffer = (arr: number[]): Buffer => {
  const float32 = new Float32Array(arr);
  return Buffer.from(float32.buffer);
};

/**
 * BufferをFloat32配列に変換
 */
const bufferToFloat32Array = (buffer: Buffer): number[] => {
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32);
};
