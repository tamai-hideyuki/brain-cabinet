import OpenAI from "openai";
import {
  saveEmbedding,
  getEmbedding,
  deleteEmbedding,
  getAllEmbeddings,
  createEmbeddingTable,
  checkEmbeddingTableExists,
} from "../repositories/embeddingRepo";
import { findNoteById, findAllNotes } from "../repositories/notesRepo";
import { normalizeText } from "../utils/normalize";

const MODEL = "text-embedding-3-small";

// OpenAI クライアント（遅延初期化）
let openaiClient: OpenAI | null = null;

const getOpenAIClient = (): OpenAI => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    openaiClient = new OpenAI();
  }
  return openaiClient;
};

/**
 * テキストからEmbeddingを生成
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const normalized = normalizeText(text).slice(0, 8000); // トークン制限対策

  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: MODEL,
    input: normalized,
  });

  return response.data[0].embedding;
};

/**
 * ノートのEmbeddingを生成・保存
 */
export const generateAndSaveNoteEmbedding = async (noteId: string): Promise<void> => {
  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }

  // タイトル + 本文を結合してEmbedding生成
  const text = `${note.title}\n\n${note.content}`;
  const embedding = await generateEmbedding(text);

  await saveEmbedding(noteId, embedding, MODEL);
};

/**
 * ノートのEmbeddingを削除
 */
export const removeNoteEmbedding = async (noteId: string): Promise<void> => {
  await deleteEmbedding(noteId);
};

/**
 * 類似ノートを検索（Cosine類似度）
 */
export const searchSimilarNotes = async (
  query: string,
  limit = 10
): Promise<Array<{ noteId: string; similarity: number }>> => {
  // クエリのEmbeddingを生成
  const queryEmbedding = await generateEmbedding(query);

  // 全ノートのEmbeddingを取得
  const allEmbeddings = await getAllEmbeddings();

  if (allEmbeddings.length === 0) {
    return [];
  }

  // Cosine類似度を計算してソート
  const results = allEmbeddings
    .map(({ noteId, embedding }) => ({
      noteId,
      similarity: cosineSimilarity(queryEmbedding, embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
};

/**
 * 特定ノートに類似したノートを検索
 */
export const findSimilarNotes = async (
  noteId: string,
  limit = 5
): Promise<Array<{ noteId: string; similarity: number }>> => {
  const targetEmbedding = await getEmbedding(noteId);
  if (!targetEmbedding) {
    throw new Error(`Embedding not found for note: ${noteId}`);
  }

  const allEmbeddings = await getAllEmbeddings();

  const results = allEmbeddings
    .filter((e) => e.noteId !== noteId) // 自身を除外
    .map(({ noteId: id, embedding }) => ({
      noteId: id,
      similarity: cosineSimilarity(targetEmbedding, embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
};

/**
 * 全ノートのEmbeddingを一括生成
 */
export const generateAllEmbeddings = async (
  onProgress?: (current: number, total: number, noteId: string) => void
): Promise<{ success: number; failed: number; errors: string[] }> => {
  // テーブルが存在しなければ作成
  const exists = await checkEmbeddingTableExists();
  if (!exists) {
    await createEmbeddingTable();
  }

  const allNotes = await findAllNotes();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < allNotes.length; i++) {
    const note = allNotes[i];
    try {
      await generateAndSaveNoteEmbedding(note.id);
      success++;
      onProgress?.(i + 1, allNotes.length, note.id);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${note.id}: ${message}`);
    }

    // Rate limit対策（1秒あたり3000リクエストまでだが念のため）
    if (i < allNotes.length - 1) {
      await sleep(100);
    }
  }

  return { success, failed, errors };
};

// ヘルパー関数

/**
 * Cosine類似度を計算
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
