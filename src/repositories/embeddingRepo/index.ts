import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const DEFAULT_MODEL = "minilm-v1";
export const DEFAULT_DIMENSIONS = 384; // MiniLM-L6-v2 は 384次元
export const EMBEDDING_VERSION = "minilm-v1";

/**
 * Embeddingを保存
 */
export const saveEmbedding = async (
  noteId: string,
  embedding: number[],
  model = DEFAULT_MODEL,
  version = EMBEDDING_VERSION
) => {
  const now = Math.floor(Date.now() / 1000);
  const embeddingBlob = float32ArrayToBuffer(embedding);

  // UPSERT（存在すれば更新、なければ挿入）
  await db.run(sql`
    INSERT INTO note_embeddings (note_id, embedding, model, dimensions, embedding_version, created_at, updated_at)
    VALUES (${noteId}, ${embeddingBlob}, ${model}, ${embedding.length}, ${version}, ${now}, ${now})
    ON CONFLICT(note_id) DO UPDATE SET
      embedding = ${embeddingBlob},
      model = ${model},
      dimensions = ${embedding.length},
      embedding_version = ${version},
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
      model TEXT NOT NULL DEFAULT 'minilm-v1',
      dimensions INTEGER NOT NULL DEFAULT 384,
      embedding_version TEXT NOT NULL DEFAULT 'minilm-v1',
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
export const float32ArrayToBuffer = (arr: number[]): Buffer => {
  const float32 = new Float32Array(arr);
  return Buffer.from(float32.buffer);
};

/**
 * BufferをFloat32配列に変換
 */
export const bufferToFloat32Array = (buffer: Buffer | ArrayBuffer | Uint8Array): number[] => {
  // libsql は ArrayBuffer を返すことがある
  let uint8: Uint8Array;

  if (buffer instanceof ArrayBuffer) {
    uint8 = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    uint8 = buffer;
  } else if (Buffer.isBuffer(buffer)) {
    uint8 = new Uint8Array(buffer);
  } else {
    // 予期しない型の場合は空配列を返す
    return [];
  }

  // Uint8Array から新しい ArrayBuffer を作成して Float32Array に変換
  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
  const float32 = new Float32Array(arrayBuffer);
  return Array.from(float32);
};

/**
 * Embeddingを削除（トランザクション対応）
 */
export const deleteEmbeddingRaw = async (
  tx: Transaction,
  noteId: string
) => {
  await tx.run(sql`DELETE FROM note_embeddings WHERE note_id = ${noteId}`);
};
