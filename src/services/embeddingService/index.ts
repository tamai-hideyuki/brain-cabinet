import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import {
  saveEmbedding,
  getEmbedding,
  deleteEmbedding,
  getAllEmbeddings,
  createEmbeddingTable,
  checkEmbeddingTableExists,
  DEFAULT_MODEL,
  EMBEDDING_VERSION,
} from "../../repositories/embeddingRepo";
import { findNoteById, findAllNotes } from "../../repositories/notesRepo";
import { normalizeText } from "../../utils/normalize";
import { logger } from "../../utils/logger";
import {
  isIndexInitialized,
  addToIndex,
  removeFromIndex,
  searchSimilarHNSW,
  buildIndex as buildHNSWIndex,
  getIndexStats,
  clearIndex,
  shouldRebuild,
  type HNSWIndexStats,
} from "./hnswIndex";

// HNSWインデックス関連のエクスポート
export {
  isIndexInitialized,
  getIndexStats,
  clearIndex,
  shouldRebuild,
  type HNSWIndexStats,
};

// MiniLM モデル（遅延初期化）
let embedder: FeatureExtractionPipeline | null = null;
let isModelLoading = false;

/**
 * MiniLM モデルを取得（遅延ロード）
 */
const getEmbedder = async (): Promise<FeatureExtractionPipeline> => {
  if (embedder) return embedder;

  if (isModelLoading) {
    // 他のリクエストがロード中の場合は待機
    while (isModelLoading) {
      await sleep(100);
    }
    if (embedder) return embedder;
  }

  isModelLoading = true;
  try {
    logger.info("[Embedding] Loading MiniLM model...");
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    logger.info("[Embedding] MiniLM model loaded");
    return embedder;
  } finally {
    isModelLoading = false;
  }
};

/**
 * テキストからEmbeddingを生成（MiniLM）
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const normalized = normalizeText(text).slice(0, 8000); // トークン制限対策

  const model = await getEmbedder();
  const output = await model(normalized, { pooling: "mean", normalize: true });

  // Float32Array を number[] に変換
  return Array.from(output.data as Float32Array);
};

/**
 * ノートのEmbeddingを生成・保存
 * HNSWインデックスにも自動追加
 */
export const generateAndSaveNoteEmbedding = async (noteId: string): Promise<void> => {
  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }

  // タイトル + 本文を結合してEmbedding生成
  const text = `${note.title}\n\n${note.content}`;
  const embedding = await generateEmbedding(text);

  // DBに保存
  await saveEmbedding(noteId, embedding, DEFAULT_MODEL, EMBEDDING_VERSION);

  // HNSWインデックスにも追加（初期化済みの場合のみ）
  if (isIndexInitialized()) {
    addToIndex(noteId, embedding);
  }
};

/**
 * ノートのEmbeddingを削除
 * HNSWインデックスからも削除
 */
export const removeNoteEmbedding = async (noteId: string): Promise<void> => {
  await deleteEmbedding(noteId);

  // HNSWインデックスからも削除
  if (isIndexInitialized()) {
    removeFromIndex(noteId);
  }
};

/**
 * 類似ノートを検索
 * HNSWインデックスが利用可能な場合は O(log n) の近似最近傍探索
 * 利用不可の場合は O(n) の線形探索にフォールバック
 */
export const searchSimilarNotes = async (
  query: string,
  limit = 10
): Promise<Array<{ noteId: string; similarity: number }>> => {
  // クエリのEmbeddingを生成
  const queryEmbedding = await generateEmbedding(query);

  // HNSWインデックスが初期化済みなら使用
  if (isIndexInitialized()) {
    logger.debug("[Embedding] Using HNSW index for similarity search");
    return searchSimilarHNSW(queryEmbedding, limit);
  }

  // フォールバック: 線形探索
  logger.debug("[Embedding] Using linear search (HNSW index not initialized)");
  const allEmbeddings = await getAllEmbeddings();

  if (allEmbeddings.length === 0) {
    return [];
  }

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
 * HNSWインデックスが利用可能な場合は O(log n) の近似最近傍探索
 */
export const findSimilarNotes = async (
  noteId: string,
  limit = 5
): Promise<Array<{ noteId: string; similarity: number }>> => {
  const targetEmbedding = await getEmbedding(noteId);
  if (!targetEmbedding) {
    throw new Error(`Embedding not found for note: ${noteId}`);
  }

  // HNSWインデックスが初期化済みなら使用
  if (isIndexInitialized()) {
    // 自身を除外するため1つ多く取得
    const results = await searchSimilarHNSW(targetEmbedding, limit + 1);
    return results.filter((r) => r.noteId !== noteId).slice(0, limit);
  }

  // フォールバック: 線形探索
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

    // MiniLMはローカルなのでRate limit不要だが、CPU負荷軽減のため少し待機
    if (i < allNotes.length - 1) {
      await sleep(10);
    }
  }

  return { success, failed, errors };
};

// ヘルパー関数

/**
 * Cosine類似度を計算
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
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

/**
 * Semantic変化スコアを計算（0 = 変化なし, 1 = 全く違う）
 */
export const semanticChangeScore = (a: number[], b: number[]): number => {
  const sim = cosineSimilarity(a, b);
  return 1 - sim;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * HNSWインデックスを構築・再構築
 */
export const buildSearchIndex = async (): Promise<{
  indexed: number;
  durationMs: number;
}> => {
  return buildHNSWIndex();
};

/**
 * HNSWインデックスの自動リビルドチェック
 * 削除済みエントリが多い場合は自動リビルド
 */
export const autoRebuildIndexIfNeeded = async (): Promise<boolean> => {
  if (shouldRebuild()) {
    logger.info("[Embedding] Auto-rebuilding HNSW index due to high deletion ratio");
    await buildHNSWIndex();
    return true;
  }
  return false;
};
