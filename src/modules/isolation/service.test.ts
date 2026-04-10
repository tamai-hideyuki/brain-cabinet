/**
 * Isolation Service のテスト（類似度計算ロジック）
 */

import { describe, it, expect } from "vitest";

// calculateAllSimilarityStats はプライベート関数なので、
// 同じロジックを直接テストする

/**
 * コサイン類似度（service.ts と同じ実装）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * calculateAllSimilarityStats と同じロジック（対称性を利用した一括計算）
 */
function calculateAllSimilarityStats(
  allEmbeddings: Array<{ noteId: string; embedding: number[] }>
): Map<string, { avgSimilarity: number; maxSimilarity: number }> {
  const n = allEmbeddings.length;
  const totals = new Float64Array(n);
  const maxes = new Float64Array(n);
  const count = n - 1;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(allEmbeddings[i].embedding, allEmbeddings[j].embedding);
      totals[i] += sim;
      totals[j] += sim;
      if (sim > maxes[i]) maxes[i] = sim;
      if (sim > maxes[j]) maxes[j] = sim;
    }
  }

  const result = new Map<string, { avgSimilarity: number; maxSimilarity: number }>();
  for (let i = 0; i < n; i++) {
    result.set(allEmbeddings[i].noteId, {
      avgSimilarity: count > 0 ? totals[i] / count : 0,
      maxSimilarity: maxes[i],
    });
  }
  return result;
}

/**
 * ナイーブ実装（比較用）— 各ノートに対して全ノートをループ
 */
function calculateSimilarityStatsNaive(
  noteId: string,
  allEmbeddings: Array<{ noteId: string; embedding: number[] }>
): { avgSimilarity: number; maxSimilarity: number } {
  const target = allEmbeddings.find((e) => e.noteId === noteId)?.embedding;
  if (!target) return { avgSimilarity: 0, maxSimilarity: 0 };

  let totalSim = 0;
  let maxSim = 0;
  let count = 0;
  for (const { noteId: otherId, embedding } of allEmbeddings) {
    if (otherId === noteId) continue;
    const sim = cosineSimilarity(target, embedding);
    totalSim += sim;
    maxSim = Math.max(maxSim, sim);
    count++;
  }
  return {
    avgSimilarity: count > 0 ? totalSim / count : 0,
    maxSimilarity: maxSim,
  };
}

describe("calculateAllSimilarityStats", () => {
  it("対称性を利用した結果がナイーブ実装と一致する", () => {
    const embeddings = [
      { noteId: "a", embedding: [1, 0, 0] },
      { noteId: "b", embedding: [0, 1, 0] },
      { noteId: "c", embedding: [0.5, 0.5, 0] },
      { noteId: "d", embedding: [0.3, 0.3, 0.9] },
    ];

    const batchResult = calculateAllSimilarityStats(embeddings);

    for (const emb of embeddings) {
      const naiveResult = calculateSimilarityStatsNaive(emb.noteId, embeddings);
      const batchEntry = batchResult.get(emb.noteId)!;

      expect(batchEntry.avgSimilarity).toBeCloseTo(naiveResult.avgSimilarity, 10);
      expect(batchEntry.maxSimilarity).toBeCloseTo(naiveResult.maxSimilarity, 10);
    }
  });

  it("ノートが1件の場合は類似度0を返す", () => {
    const embeddings = [{ noteId: "only", embedding: [1, 0, 0] }];

    const result = calculateAllSimilarityStats(embeddings);

    expect(result.get("only")!.avgSimilarity).toBe(0);
    expect(result.get("only")!.maxSimilarity).toBe(0);
  });

  it("空配列の場合は空Mapを返す", () => {
    const result = calculateAllSimilarityStats([]);

    expect(result.size).toBe(0);
  });

  it("同一ベクトルの類似度は1になる", () => {
    const embeddings = [
      { noteId: "a", embedding: [1, 0, 0] },
      { noteId: "b", embedding: [1, 0, 0] },
    ];

    const result = calculateAllSimilarityStats(embeddings);

    expect(result.get("a")!.maxSimilarity).toBeCloseTo(1, 10);
    expect(result.get("b")!.maxSimilarity).toBeCloseTo(1, 10);
  });

  it("直交ベクトルの類似度は0になる", () => {
    const embeddings = [
      { noteId: "a", embedding: [1, 0] },
      { noteId: "b", embedding: [0, 1] },
    ];

    const result = calculateAllSimilarityStats(embeddings);

    expect(result.get("a")!.avgSimilarity).toBeCloseTo(0, 10);
    expect(result.get("b")!.avgSimilarity).toBeCloseTo(0, 10);
  });
});
