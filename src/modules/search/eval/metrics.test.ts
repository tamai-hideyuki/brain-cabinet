import { describe, it, expect } from "vitest";
import { ndcgAtK, firstRelevantRank, aggregate } from "./metrics";

describe("ndcgAtK", () => {
  it("関連ノートが全て先頭にある場合は1.0を返す", () => {
    const retrieved = ["a", "b", "c", "d", "e"];
    const relevant = new Set(["a", "b"]);

    const result = ndcgAtK(retrieved, relevant, 10);

    expect(result).toBeCloseTo(1.0, 5);
  });

  it("関連ノートが一つも含まれない場合は0を返す", () => {
    expect(ndcgAtK(["x", "y", "z"], new Set(["a", "b"]), 10)).toBe(0);
  });

  it("関連ノート集合が空の場合は0を返す", () => {
    expect(ndcgAtK(["a", "b"], new Set(), 10)).toBe(0);
  });

  it("関連ノートの順位が下がるほどスコアが低くなる", () => {
    const topHit = ndcgAtK(["a", "x", "y"], new Set(["a"]), 10);
    const midHit = ndcgAtK(["x", "a", "y"], new Set(["a"]), 10);
    const lowHit = ndcgAtK(["x", "y", "a"], new Set(["a"]), 10);

    expect(topHit).toBeGreaterThan(midHit);
    expect(midHit).toBeGreaterThan(lowHit);
    expect(topHit).toBeCloseTo(1.0, 5);
  });
});

describe("firstRelevantRank", () => {
  it("最初にマッチした順位を1始まりで返す", () => {
    expect(firstRelevantRank(["x", "a", "y"], new Set(["a"]))).toBe(2);
  });

  it("マッチしない場合はnullを返す", () => {
    expect(firstRelevantRank(["x", "y"], new Set(["a"]))).toBe(null);
  });
});

describe("aggregate", () => {
  it("複数クエリの指標を平均して返す", () => {
    const queries = [
      { retrieved: ["a", "x"], relevant: new Set(["a"]) },
      { retrieved: ["y", "b"], relevant: new Set(["b"]) },
    ];

    const result = aggregate(queries);

    expect(result.mrr).toBeCloseTo((1 + 0.5) / 2);
    expect(result.recall20).toBe(1);
  });

  it("入力が空配列の場合は全指標が0になる", () => {
    const result = aggregate([]);

    expect(result).toStrictEqual({
      ndcg10: 0,
      mrr: 0,
      recall20: 0,
      precision10: 0,
    });
  });

  describe("aggregate経由のMRR挙動", () => {
    it("先頭が関連ノートの場合は1.0を返す", () => {
      const result = aggregate([{ retrieved: ["a", "b"], relevant: new Set(["a"]) }]);
      expect(result.mrr).toBe(1);
    });

    it("3番目が関連ノートの場合は1/3を返す", () => {
      const result = aggregate([
        { retrieved: ["x", "y", "a"], relevant: new Set(["a"]) },
      ]);
      expect(result.mrr).toBeCloseTo(1 / 3);
    });

    it("マッチしない場合は0を返す", () => {
      const result = aggregate([{ retrieved: ["x", "y"], relevant: new Set(["a"]) }]);
      expect(result.mrr).toBe(0);
    });
  });

  describe("aggregate経由のRecall@20挙動", () => {
    it("関連ノートが全てtop-20に含まれる場合は1.0を返す", () => {
      const result = aggregate([
        { retrieved: ["a", "b", "c"], relevant: new Set(["a", "b"]) },
      ]);
      expect(result.recall20).toBe(1);
    });

    it("一部しかヒットしない場合は割合を返す", () => {
      const result = aggregate([
        { retrieved: ["a", "x", "y"], relevant: new Set(["a", "b"]) },
      ]);
      expect(result.recall20).toBe(0.5);
    });

    it("関連ノート集合が空の場合は0を返す", () => {
      const result = aggregate([{ retrieved: ["a"], relevant: new Set() }]);
      expect(result.recall20).toBe(0);
    });
  });

  describe("aggregate経由のPrecision@10挙動", () => {
    it("top-10に含まれる関連ノートの割合を返す", () => {
      const result = aggregate([
        { retrieved: ["a", "b", "x"], relevant: new Set(["a", "b"]) },
      ]);
      expect(result.precision10).toBeCloseTo(2 / 3);
    });

    it("検索結果が空の場合は0を返す", () => {
      const result = aggregate([{ retrieved: [], relevant: new Set(["a"]) }]);
      expect(result.precision10).toBe(0);
    });

    it("top-10より後ろにある関連ノートはカウントしない", () => {
      const retrieved = Array.from({ length: 15 }, (_, i) => `n${i}`);

      const result = aggregate([
        { retrieved, relevant: new Set(["n12"]) },
      ]);

      expect(result.precision10).toBe(0);
    });
  });
});
