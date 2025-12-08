/**
 * HNSW (Hierarchical Navigable Small World) インデックス
 *
 * 近似最近傍探索を O(log n) で実現
 */

import HierarchicalNSW from "hnswlib-node";
import { getAllEmbeddings } from "../../repositories/embeddingRepo";
import { logger } from "../../utils/logger";
import { cosineSimilarity } from "./index";

// インデックス設定
const DIMENSIONS = 384; // MiniLM-L6-v2
const MAX_ELEMENTS = 100_000; // 最大ノート数
const EF_CONSTRUCTION = 200; // インデックス構築時の精度（高い = 精度↑、構築時間↑）
const M = 16; // グラフの接続数（高い = 精度↑、メモリ↑）

// シングルトンインデックス
let hnswIndex: HierarchicalNSW.HierarchicalNSW | null = null;
let noteIdToLabel: Map<string, number> = new Map();
let labelToNoteId: Map<number, string> = new Map();
let nextLabel = 0;
let isIndexBuilding = false;
let lastBuildTime: number | null = null;
let indexedCount = 0;

// インデックス統計
export interface HNSWIndexStats {
  isInitialized: boolean;
  indexedCount: number;
  maxElements: number;
  lastBuildTime: number | null;
  dimensions: number;
  efConstruction: number;
  m: number;
}

/**
 * インデックスを初期化
 */
export const initIndex = (): void => {
  if (hnswIndex) return;

  hnswIndex = new HierarchicalNSW.HierarchicalNSW("cosine", DIMENSIONS);
  hnswIndex.initIndex(MAX_ELEMENTS, M, EF_CONSTRUCTION);
  noteIdToLabel.clear();
  labelToNoteId.clear();
  nextLabel = 0;
  indexedCount = 0;

  logger.info(
    `[HNSW] Index initialized (dimensions=${DIMENSIONS}, maxElements=${MAX_ELEMENTS}, efConstruction=${EF_CONSTRUCTION}, m=${M})`
  );
};

/**
 * インデックスが初期化済みかどうか
 */
export const isIndexInitialized = (): boolean => {
  return hnswIndex !== null && indexedCount > 0;
};

/**
 * インデックスの統計情報を取得
 */
export const getIndexStats = (): HNSWIndexStats => {
  return {
    isInitialized: isIndexInitialized(),
    indexedCount,
    maxElements: MAX_ELEMENTS,
    lastBuildTime,
    dimensions: DIMENSIONS,
    efConstruction: EF_CONSTRUCTION,
    m: M,
  };
};

/**
 * インデックスを構築（全Embeddingから）
 */
export const buildIndex = async (): Promise<{
  indexed: number;
  durationMs: number;
}> => {
  if (isIndexBuilding) {
    throw new Error("Index build already in progress");
  }

  isIndexBuilding = true;
  const startTime = Date.now();

  try {
    // インデックスをリセット
    hnswIndex = new HierarchicalNSW.HierarchicalNSW("cosine", DIMENSIONS);
    hnswIndex.initIndex(MAX_ELEMENTS, M, EF_CONSTRUCTION);
    noteIdToLabel.clear();
    labelToNoteId.clear();
    nextLabel = 0;

    // 全Embeddingを取得
    const allEmbeddings = await getAllEmbeddings();

    if (allEmbeddings.length === 0) {
      logger.warn("[HNSW] No embeddings found, index is empty");
      indexedCount = 0;
      lastBuildTime = Date.now();
      return { indexed: 0, durationMs: Date.now() - startTime };
    }

    // インデックスに追加
    for (const { noteId, embedding } of allEmbeddings) {
      const label = nextLabel++;
      noteIdToLabel.set(noteId, label);
      labelToNoteId.set(label, noteId);
      hnswIndex.addPoint(embedding, label);
    }

    indexedCount = allEmbeddings.length;
    lastBuildTime = Date.now();
    const durationMs = Date.now() - startTime;

    logger.info(
      `[HNSW] Index built successfully (indexed=${indexedCount}, durationMs=${durationMs})`
    );

    return { indexed: indexedCount, durationMs };
  } finally {
    isIndexBuilding = false;
  }
};

/**
 * 単一のEmbeddingをインデックスに追加
 */
export const addToIndex = (noteId: string, embedding: number[]): void => {
  if (!hnswIndex) {
    initIndex();
  }

  // 既存のラベルがあれば再利用（更新の場合）
  let label = noteIdToLabel.get(noteId);

  if (label === undefined) {
    // 新規追加
    label = nextLabel++;
    noteIdToLabel.set(noteId, label);
    labelToNoteId.set(label, noteId);
    indexedCount++;
  }

  // HNSWは同じラベルで上書き可能
  hnswIndex!.addPoint(embedding, label);

  logger.debug(`[HNSW] Added/updated point (noteId=${noteId}, label=${label})`);
};

/**
 * インデックスからノートを削除
 * 注: hnswlib-nodeは直接削除をサポートしていないため、
 * 削除フラグを管理して検索時にフィルタリング
 */
const deletedLabels: Set<number> = new Set();

export const removeFromIndex = (noteId: string): void => {
  const label = noteIdToLabel.get(noteId);
  if (label !== undefined) {
    deletedLabels.add(label);
    noteIdToLabel.delete(noteId);
    labelToNoteId.delete(label);
    indexedCount--;
    logger.debug(`[HNSW] Marked point as deleted (noteId=${noteId}, label=${label})`);
  }
};

/**
 * 近似最近傍探索（HNSW）
 */
export const searchSimilarHNSW = async (
  queryEmbedding: number[],
  limit: number = 10,
  efSearch: number = 50
): Promise<Array<{ noteId: string; similarity: number }>> => {
  // インデックスが空または未初期化の場合はフォールバック
  if (!isIndexInitialized()) {
    logger.warn("[HNSW] Index not initialized, falling back to linear search");
    return linearSearch(queryEmbedding, limit);
  }

  // 検索時の精度パラメータを設定（高い = 精度↑、速度↓）
  hnswIndex!.setEf(efSearch);

  // 削除済みを考慮して多めに取得
  const fetchCount = Math.min(limit + deletedLabels.size + 10, indexedCount);

  const result = hnswIndex!.searchKnn(queryEmbedding, fetchCount);

  const results: Array<{ noteId: string; similarity: number }> = [];

  for (let i = 0; i < result.neighbors.length && results.length < limit; i++) {
    const label = result.neighbors[i];
    const distance = result.distances[i];

    // 削除済みをスキップ
    if (deletedLabels.has(label)) continue;

    const noteId = labelToNoteId.get(label);
    if (!noteId) continue;

    // cosine distanceをsimilarityに変換
    // hnswlib-nodeのcosine spaceは 1 - similarity を返す
    const similarity = 1 - distance;

    results.push({ noteId, similarity });
  }

  return results;
};

/**
 * 線形探索（フォールバック用）
 */
const linearSearch = async (
  queryEmbedding: number[],
  limit: number
): Promise<Array<{ noteId: string; similarity: number }>> => {
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
 * インデックスをクリア
 */
export const clearIndex = (): void => {
  hnswIndex = null;
  noteIdToLabel.clear();
  labelToNoteId.clear();
  deletedLabels.clear();
  nextLabel = 0;
  indexedCount = 0;
  lastBuildTime = null;

  logger.info("[HNSW] Index cleared");
};

/**
 * 削除済みエントリが多い場合はリビルドを推奨
 */
export const shouldRebuild = (): boolean => {
  if (indexedCount === 0) return false;
  const deletedRatio = deletedLabels.size / (indexedCount + deletedLabels.size);
  return deletedRatio > 0.2; // 20%以上が削除済みならリビルド推奨
};
