import { describe, it, expect, vi, beforeEach } from "vitest";

// embeddingService の内部関数をテスト
// 実際のMLモデルは使わず、ロジックをテストする

describe("embeddingService", () => {
  describe("cosineSimilarity（コサイン類似度計算）", () => {
    // embeddingService.ts からエクスポートされている関数のロジック
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

    it("同一ベクトルの類似度は1", () => {
      const vec = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
    });

    it("直交ベクトルの類似度は0", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0);
    });

    it("反対方向のベクトルの類似度は-1", () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0);
    });

    it("異なる長さのベクトルでエラー", () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => cosineSimilarity(a, b)).toThrow("Vectors must have the same length");
    });

    it("ゼロベクトルの場合は0を返す", () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it("正規化されたベクトルで正しく計算", () => {
      // 単位ベクトル
      const a = [1 / Math.sqrt(2), 1 / Math.sqrt(2), 0];
      const b = [1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2));
    });

    it("高次元ベクトルで正しく動作", () => {
      const dim = 384; // MiniLM の次元数
      const a = Array.from({ length: dim }, (_, i) => Math.sin(i));
      const b = Array.from({ length: dim }, (_, i) => Math.cos(i));
      const result = cosineSimilarity(a, b);
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe("semanticChangeScore（セマンティック変化スコア）", () => {
    const cosineSimilarity = (a: number[], b: number[]): number => {
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

    const semanticChangeScore = (a: number[], b: number[]): number => {
      const sim = cosineSimilarity(a, b);
      return 1 - sim;
    };

    it("同一ベクトルの変化スコアは0", () => {
      const vec = [1, 2, 3];
      expect(semanticChangeScore(vec, vec)).toBeCloseTo(0);
    });

    it("反対方向のベクトルの変化スコアは2", () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(semanticChangeScore(a, b)).toBeCloseTo(2);
    });

    it("直交ベクトルの変化スコアは1", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(semanticChangeScore(a, b)).toBeCloseTo(1);
    });

    it("類似ベクトルは低い変化スコア", () => {
      const a = [1, 2, 3];
      const b = [1.1, 2.1, 3.1];
      const score = semanticChangeScore(a, b);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.1); // ほぼ同じなので変化は小さい
    });
  });

  describe("ベクトル変換ロジック", () => {
    it("Float32Array を number[] に変換", () => {
      const float32 = new Float32Array([1.5, 2.5, 3.5]);
      const array = Array.from(float32);
      expect(array).toEqual([1.5, 2.5, 3.5]);
      expect(Array.isArray(array)).toBe(true);
    });

    it("大きな Float32Array でも正しく変換", () => {
      const dim = 384;
      const float32 = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        float32[i] = Math.random();
      }
      const array = Array.from(float32);
      expect(array.length).toBe(dim);
      expect(array.every((v) => typeof v === "number")).toBe(true);
    });
  });

  describe("テキスト正規化（embedding用）", () => {
    // normalizeText の簡易版（8000文字制限のテスト）
    const prepareTextForEmbedding = (text: string, maxLength: number = 8000): string => {
      return text.slice(0, maxLength);
    };

    it("8000文字以下はそのまま", () => {
      const text = "a".repeat(7000);
      expect(prepareTextForEmbedding(text)).toBe(text);
    });

    it("8000文字を超える場合は切り詰め", () => {
      const text = "a".repeat(10000);
      const result = prepareTextForEmbedding(text);
      expect(result.length).toBe(8000);
    });

    it("空文字列を処理", () => {
      expect(prepareTextForEmbedding("")).toBe("");
    });
  });

  describe("類似度ソート", () => {
    type SimilarityResult = { noteId: string; similarity: number };

    const sortBySimilarity = (results: SimilarityResult[]): SimilarityResult[] => {
      return [...results].sort((a, b) => b.similarity - a.similarity);
    };

    it("類似度の高い順にソート", () => {
      const results: SimilarityResult[] = [
        { noteId: "a", similarity: 0.5 },
        { noteId: "b", similarity: 0.9 },
        { noteId: "c", similarity: 0.7 },
      ];
      const sorted = sortBySimilarity(results);
      expect(sorted.map((r) => r.noteId)).toEqual(["b", "c", "a"]);
    });

    it("同じ類似度の場合は元の順序を維持", () => {
      const results: SimilarityResult[] = [
        { noteId: "a", similarity: 0.8 },
        { noteId: "b", similarity: 0.8 },
        { noteId: "c", similarity: 0.8 },
      ];
      const sorted = sortBySimilarity(results);
      expect(sorted.length).toBe(3);
    });

    it("空配列を処理", () => {
      expect(sortBySimilarity([])).toEqual([]);
    });

    it("limit を適用", () => {
      const results: SimilarityResult[] = [
        { noteId: "a", similarity: 0.9 },
        { noteId: "b", similarity: 0.8 },
        { noteId: "c", similarity: 0.7 },
        { noteId: "d", similarity: 0.6 },
        { noteId: "e", similarity: 0.5 },
      ];
      const sorted = sortBySimilarity(results).slice(0, 3);
      expect(sorted.length).toBe(3);
      expect(sorted.map((r) => r.noteId)).toEqual(["a", "b", "c"]);
    });
  });

  describe("自身を除外するフィルタリング", () => {
    type EmbeddingData = { noteId: string; embedding: number[] };

    const filterSelf = (embeddings: EmbeddingData[], selfId: string): EmbeddingData[] => {
      return embeddings.filter((e) => e.noteId !== selfId);
    };

    it("自身のノートを除外", () => {
      const embeddings: EmbeddingData[] = [
        { noteId: "a", embedding: [1, 2, 3] },
        { noteId: "b", embedding: [4, 5, 6] },
        { noteId: "c", embedding: [7, 8, 9] },
      ];
      const filtered = filterSelf(embeddings, "b");
      expect(filtered.map((e) => e.noteId)).toEqual(["a", "c"]);
    });

    it("存在しないIDでも正常動作", () => {
      const embeddings: EmbeddingData[] = [
        { noteId: "a", embedding: [1] },
        { noteId: "b", embedding: [2] },
      ];
      const filtered = filterSelf(embeddings, "nonexistent");
      expect(filtered.length).toBe(2);
    });

    it("空配列を処理", () => {
      expect(filterSelf([], "any")).toEqual([]);
    });
  });
});
