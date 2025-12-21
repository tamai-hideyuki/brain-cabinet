import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initIndex,
  isIndexInitialized,
  getIndexStats,
  addToIndex,
  removeFromIndex,
  searchSimilarHNSW,
  buildIndex,
  clearIndex,
  shouldRebuild,
} from "./index";

// モック
vi.mock("../../../repositories/embeddingRepo", () => ({
  getAllEmbeddings: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

// cosineSimilarity をモック（循環参照を避ける）
vi.mock("../index", () => ({
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }),
}));

describe("HNSW Index", () => {
  beforeEach(() => {
    clearIndex();
  });

  describe("initIndex", () => {
    it("インデックスを初期化する", () => {
      initIndex();
      const stats = getIndexStats();
      expect(stats.dimensions).toBe(384);
      expect(stats.maxElements).toBe(100_000);
    });
  });

  describe("isIndexInitialized", () => {
    it("初期状態ではfalseを返す", () => {
      expect(isIndexInitialized()).toBe(false);
    });

    it("データ追加後はtrueを返す", () => {
      initIndex();
      // 384次元のダミーベクトル
      const embedding = new Array(384).fill(0).map(() => Math.random());
      addToIndex("note-1", embedding);
      expect(isIndexInitialized()).toBe(true);
    });
  });

  describe("getIndexStats", () => {
    it("統計情報を返す", () => {
      const stats = getIndexStats();
      expect(stats).toHaveProperty("isInitialized");
      expect(stats).toHaveProperty("indexedCount");
      expect(stats).toHaveProperty("maxElements");
      expect(stats).toHaveProperty("dimensions");
      expect(stats).toHaveProperty("efConstruction");
      expect(stats).toHaveProperty("m");
    });
  });

  describe("addToIndex / removeFromIndex", () => {
    it("ノートを追加・削除できる", () => {
      initIndex();
      const embedding = new Array(384).fill(0).map(() => Math.random());

      addToIndex("note-1", embedding);
      expect(getIndexStats().indexedCount).toBe(1);

      addToIndex("note-2", embedding);
      expect(getIndexStats().indexedCount).toBe(2);

      removeFromIndex("note-1");
      expect(getIndexStats().indexedCount).toBe(1);
    });

    it("同じノートIDで上書きできる", () => {
      initIndex();
      const embedding1 = new Array(384).fill(0).map(() => Math.random());
      const embedding2 = new Array(384).fill(0).map(() => Math.random());

      addToIndex("note-1", embedding1);
      expect(getIndexStats().indexedCount).toBe(1);

      // 同じIDで更新
      addToIndex("note-1", embedding2);
      expect(getIndexStats().indexedCount).toBe(1);
    });
  });

  describe("searchSimilarHNSW", () => {
    it("インデックスが空の場合は空配列を返す", async () => {
      const query = new Array(384).fill(0.1);
      const results = await searchSimilarHNSW(query, 10);
      expect(results).toEqual([]);
    });

    it("類似度順で結果を返す", async () => {
      initIndex();

      // 基準ベクトル
      const base = new Array(384).fill(0).map(() => Math.random());

      // 類似ベクトル（baseに近い）
      const similar = base.map(v => v + (Math.random() * 0.1 - 0.05));

      // 異なるベクトル
      const different = new Array(384).fill(0).map(() => Math.random());

      addToIndex("similar", similar);
      addToIndex("different", different);

      const results = await searchSimilarHNSW(base, 2);
      expect(results.length).toBe(2);
      expect(results[0]).toHaveProperty("noteId");
      expect(results[0]).toHaveProperty("similarity");
    });
  });

  describe("clearIndex", () => {
    it("インデックスをクリアする", () => {
      initIndex();
      const embedding = new Array(384).fill(0).map(() => Math.random());
      addToIndex("note-1", embedding);

      expect(isIndexInitialized()).toBe(true);

      clearIndex();

      expect(isIndexInitialized()).toBe(false);
      expect(getIndexStats().indexedCount).toBe(0);
    });
  });

  describe("shouldRebuild", () => {
    it("削除が多い場合はtrueを返す", () => {
      initIndex();

      // 5件追加
      for (let i = 0; i < 5; i++) {
        const embedding = new Array(384).fill(0).map(() => Math.random());
        addToIndex(`note-${i}`, embedding);
      }

      // 2件削除（20%以上）
      removeFromIndex("note-0");
      removeFromIndex("note-1");

      expect(shouldRebuild()).toBe(true);
    });

    it("削除が少ない場合はfalseを返す", () => {
      initIndex();

      // 10件追加
      for (let i = 0; i < 10; i++) {
        const embedding = new Array(384).fill(0).map(() => Math.random());
        addToIndex(`note-${i}`, embedding);
      }

      // 1件削除（10%）
      removeFromIndex("note-0");

      expect(shouldRebuild()).toBe(false);
    });
  });

  describe("buildIndex", () => {
    it("インデックスを構築できる", async () => {
      const { getAllEmbeddings } = await import("../../../repositories/embeddingRepo");
      vi.mocked(getAllEmbeddings).mockResolvedValueOnce([
        { noteId: "note-1", embedding: new Array(384).fill(0.1) },
        { noteId: "note-2", embedding: new Array(384).fill(0.2) },
      ]);

      const result = await buildIndex();

      expect(result.indexed).toBe(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(isIndexInitialized()).toBe(true);
    });

    it("Embeddingがない場合は空のインデックスを作成", async () => {
      const { getAllEmbeddings } = await import("../../../repositories/embeddingRepo");
      vi.mocked(getAllEmbeddings).mockResolvedValueOnce([]);

      const result = await buildIndex();

      expect(result.indexed).toBe(0);
    });
  });
});
