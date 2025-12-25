import { describe, it, expect } from "vitest";
import {
  DEFAULT_DECAY_RATE,
  DECAY_PRESETS,
  calculateDaysSinceCreation,
  applyTimeDecay,
  calculateHalfLife,
  calculateLambdaFromHalfLife,
  applyTimeDecayToEdges,
  filterByDecayedWeight,
  sortByDecayedWeight,
  calculateTimeDecayStats,
} from "./index";

describe("timeDecay", () => {
  describe("constants", () => {
    it("DEFAULT_DECAY_RATE は 0.02", () => {
      expect(DEFAULT_DECAY_RATE).toBe(0.02);
    });

    it("DECAY_PRESETS が正しく定義されている", () => {
      expect(DECAY_PRESETS.slow).toBe(0.01);
      expect(DECAY_PRESETS.balanced).toBe(0.02);
      expect(DECAY_PRESETS.fast).toBe(0.05);
    });
  });

  describe("calculateDaysSinceCreation", () => {
    it("経過日数を正しく計算する", () => {
      const now = 1000000;
      const createdAt = 1000000 - 86400 * 7; // 7日前
      expect(calculateDaysSinceCreation(createdAt, now)).toBe(7);
    });

    it("同時刻の場合は0を返す", () => {
      const now = 1000000;
      expect(calculateDaysSinceCreation(now, now)).toBe(0);
    });

    it("未来の日付の場合は0を返す（負の値にならない）", () => {
      const now = 1000000;
      const futureTime = now + 86400;
      expect(calculateDaysSinceCreation(futureTime, now)).toBe(0);
    });

    it("小数点以下の日数を正しく計算する", () => {
      const now = 1000000;
      const createdAt = now - 86400 / 2; // 0.5日前
      expect(calculateDaysSinceCreation(createdAt, now)).toBe(0.5);
    });
  });

  describe("applyTimeDecay", () => {
    it("経過日数0の場合は元の重みを返す", () => {
      expect(applyTimeDecay(0.8, 0)).toBe(0.8);
    });

    it("λ = 0 の場合は元の重みを返す", () => {
      expect(applyTimeDecay(0.8, 14, 0)).toBe(0.8);
    });

    it("負の経過日数の場合は元の重みを返す", () => {
      expect(applyTimeDecay(0.8, -5)).toBe(0.8);
    });

    it("2週間経過、λ = 0.02 で正しく減衰する", () => {
      // 0.8 × exp(-0.02 × 14) ≈ 0.6
      const result = applyTimeDecay(0.8, 14, 0.02);
      expect(result).toBeCloseTo(0.8 * Math.exp(-0.02 * 14), 4);
    });

    it("1ヶ月経過、λ = 0.02 で正しく減衰する", () => {
      // 0.8 × exp(-0.02 × 30) ≈ 0.44
      const result = applyTimeDecay(0.8, 30, 0.02);
      expect(result).toBeCloseTo(0.8 * Math.exp(-0.02 * 30), 4);
    });

    it("6ヶ月経過で大幅に減衰する", () => {
      const result = applyTimeDecay(0.8, 180, 0.02);
      expect(result).toBeLessThan(0.1);
    });

    it("fast プリセット（λ = 0.05）で急速に減衰する", () => {
      const result = applyTimeDecay(0.8, 14, DECAY_PRESETS.fast);
      // 0.8 × exp(-0.05 × 14) ≈ 0.4
      expect(result).toBeCloseTo(0.8 * Math.exp(-0.05 * 14), 4);
    });

    it("slow プリセット（λ = 0.01）で緩やかに減衰する", () => {
      const result = applyTimeDecay(0.8, 14, DECAY_PRESETS.slow);
      // 0.8 × exp(-0.01 × 14) ≈ 0.69
      expect(result).toBeCloseTo(0.8 * Math.exp(-0.01 * 14), 4);
      expect(result).toBeGreaterThan(0.6);
    });
  });

  describe("calculateHalfLife", () => {
    it("λ = 0.02 で半減期 ≈ 35日", () => {
      const halfLife = calculateHalfLife(0.02);
      expect(halfLife).toBeCloseTo(34.66, 1);
    });

    it("λ = 0.01 で半減期 ≈ 70日", () => {
      const halfLife = calculateHalfLife(0.01);
      expect(halfLife).toBeCloseTo(69.31, 1);
    });

    it("λ = 0.05 で半減期 ≈ 14日", () => {
      const halfLife = calculateHalfLife(0.05);
      expect(halfLife).toBeCloseTo(13.86, 1);
    });

    it("λ = 0 で Infinity を返す", () => {
      expect(calculateHalfLife(0)).toBe(Infinity);
    });

    it("λ < 0 で Infinity を返す", () => {
      expect(calculateHalfLife(-0.1)).toBe(Infinity);
    });
  });

  describe("calculateLambdaFromHalfLife", () => {
    it("半減期35日 → λ ≈ 0.02", () => {
      const lambda = calculateLambdaFromHalfLife(35);
      expect(lambda).toBeCloseTo(0.0198, 3);
    });

    it("半減期70日 → λ ≈ 0.01", () => {
      const lambda = calculateLambdaFromHalfLife(70);
      expect(lambda).toBeCloseTo(0.0099, 3);
    });

    it("半減期14日 → λ ≈ 0.05", () => {
      const lambda = calculateLambdaFromHalfLife(14);
      expect(lambda).toBeCloseTo(0.0495, 3);
    });

    it("半減期0 で Infinity を返す", () => {
      expect(calculateLambdaFromHalfLife(0)).toBe(Infinity);
    });

    it("半減期 < 0 で Infinity を返す", () => {
      expect(calculateLambdaFromHalfLife(-10)).toBe(Infinity);
    });

    it("calculateHalfLife と相互変換できる", () => {
      const originalLambda = 0.02;
      const halfLife = calculateHalfLife(originalLambda);
      const recoveredLambda = calculateLambdaFromHalfLife(halfLife);
      expect(recoveredLambda).toBeCloseTo(originalLambda, 6);
    });
  });

  describe("applyTimeDecayToEdges", () => {
    const now = 1000000;

    it("複数のエッジに減衰を適用する", () => {
      const edges = [
        { weight: 0.8, createdAt: now - 86400 * 7 },  // 7日前
        { weight: 0.6, createdAt: now - 86400 * 14 }, // 14日前
        { weight: 0.4, createdAt: now - 86400 * 30 }, // 30日前
      ];

      const result = applyTimeDecayToEdges(edges, 0.02, now);

      expect(result).toHaveLength(3);

      // 7日前のエッジ
      expect(result[0].daysSinceCreation).toBe(7);
      expect(result[0].decayedWeight).toBeCloseTo(0.8 * Math.exp(-0.02 * 7), 3);

      // 14日前のエッジ
      expect(result[1].daysSinceCreation).toBe(14);
      expect(result[1].decayedWeight).toBeCloseTo(0.6 * Math.exp(-0.02 * 14), 3);

      // 30日前のエッジ
      expect(result[2].daysSinceCreation).toBe(30);
      expect(result[2].decayedWeight).toBeCloseTo(0.4 * Math.exp(-0.02 * 30), 3);
    });

    it("空配列の場合は空配列を返す", () => {
      const result = applyTimeDecayToEdges([], 0.02, now);
      expect(result).toEqual([]);
    });

    it("decayFactor が正しく計算される", () => {
      const edges = [
        { weight: 1.0, createdAt: now - 86400 * 35 }, // 35日前（半減期付近）
      ];

      const result = applyTimeDecayToEdges(edges, 0.02, now);

      // 半減期35日なので、decayFactor ≈ 0.5
      expect(result[0].decayFactor).toBeCloseTo(0.5, 1);
    });

    it("元のエッジオブジェクトを変更しない", () => {
      const edges = [
        { weight: 0.8, createdAt: now - 86400 * 7, extra: "data" },
      ];

      const result = applyTimeDecayToEdges(edges, 0.02, now);

      expect(edges[0]).not.toHaveProperty("decayedWeight");
      expect(result[0]).toHaveProperty("extra", "data");
    });
  });

  describe("filterByDecayedWeight", () => {
    it("閾値以上のエッジをフィルタリングする", () => {
      const edges = [
        { decayedWeight: 0.1 },
        { decayedWeight: 0.05 },
        { decayedWeight: 0.03 },
        { decayedWeight: 0.2 },
      ];

      const result = filterByDecayedWeight(edges, 0.05);

      expect(result).toHaveLength(3);
      expect(result.every((e) => e.decayedWeight >= 0.05)).toBe(true);
    });

    it("デフォルト閾値は 0.05", () => {
      const edges = [
        { decayedWeight: 0.06 },
        { decayedWeight: 0.04 },
      ];

      const result = filterByDecayedWeight(edges);

      expect(result).toHaveLength(1);
      expect(result[0].decayedWeight).toBe(0.06);
    });

    it("全てのエッジが閾値未満の場合は空配列を返す", () => {
      const edges = [
        { decayedWeight: 0.01 },
        { decayedWeight: 0.02 },
      ];

      const result = filterByDecayedWeight(edges, 0.05);

      expect(result).toEqual([]);
    });
  });

  describe("sortByDecayedWeight", () => {
    it("減衰後の重みで降順にソートする", () => {
      const edges = [
        { decayedWeight: 0.2 },
        { decayedWeight: 0.5 },
        { decayedWeight: 0.1 },
        { decayedWeight: 0.3 },
      ];

      const result = sortByDecayedWeight(edges);

      expect(result.map((e) => e.decayedWeight)).toEqual([0.5, 0.3, 0.2, 0.1]);
    });

    it("元の配列を変更しない", () => {
      const edges = [
        { decayedWeight: 0.2 },
        { decayedWeight: 0.5 },
      ];

      sortByDecayedWeight(edges);

      expect(edges[0].decayedWeight).toBe(0.2);
      expect(edges[1].decayedWeight).toBe(0.5);
    });
  });

  describe("calculateTimeDecayStats", () => {
    it("統計を正しく計算する", () => {
      const edges = [
        { weight: 0.8, decayedWeight: 0.6, decayFactor: 0.75, daysSinceCreation: 10 },
        { weight: 0.6, decayedWeight: 0.3, decayFactor: 0.5, daysSinceCreation: 35 },
        { weight: 0.4, decayedWeight: 0.1, decayFactor: 0.25, daysSinceCreation: 60 },
      ];

      const stats = calculateTimeDecayStats(edges, 0.05);

      expect(stats.totalEdges).toBe(3);
      expect(stats.avgOriginalWeight).toBeCloseTo(0.6, 2);
      expect(stats.avgDecayedWeight).toBeCloseTo(0.3333, 2);
      expect(stats.avgDecayFactor).toBe(0.5);
      expect(stats.avgAge).toBeCloseTo(35, 0);
      expect(stats.oldestEdgeAge).toBe(60);
      expect(stats.newestEdgeAge).toBe(10);
      expect(stats.effectiveEdges).toBe(3); // 全て0.05以上
      expect(stats.decayImpact).toBe(0.5); // 1 - 0.5
    });

    it("空配列の場合はゼロ統計を返す", () => {
      const stats = calculateTimeDecayStats([]);

      expect(stats.totalEdges).toBe(0);
      expect(stats.avgOriginalWeight).toBe(0);
      expect(stats.avgDecayedWeight).toBe(0);
      expect(stats.avgDecayFactor).toBe(1);
      expect(stats.avgAge).toBe(0);
      expect(stats.decayImpact).toBe(0);
    });

    it("effectiveEdges が閾値でフィルタリングされる", () => {
      const edges = [
        { weight: 0.8, decayedWeight: 0.1, decayFactor: 0.125, daysSinceCreation: 100 },
        { weight: 0.6, decayedWeight: 0.03, decayFactor: 0.05, daysSinceCreation: 150 },
        { weight: 0.4, decayedWeight: 0.01, decayFactor: 0.025, daysSinceCreation: 200 },
      ];

      const stats = calculateTimeDecayStats(edges, 0.05);

      expect(stats.effectiveEdges).toBe(1); // 0.1 のみ
    });
  });

  describe("統合テスト: 減衰シナリオ", () => {
    it("時間経過によるランキング変動をシミュレート", () => {
      const now = 1000000;

      // 古いが元の重みが高いエッジ vs 新しいが重みが低いエッジ
      const edges = [
        { id: "old-strong", weight: 0.9, createdAt: now - 86400 * 60 }, // 60日前、高重み
        { id: "new-weak", weight: 0.4, createdAt: now - 86400 * 5 },    // 5日前、低重み
      ];

      const withDecay = applyTimeDecayToEdges(edges, 0.02, now);
      const sorted = sortByDecayedWeight(withDecay);

      // 新しいエッジが減衰後に上位に来る
      expect(sorted[0].id).toBe("new-weak");
      // 古いエッジは大幅に減衰
      expect(withDecay.find((e) => e.id === "old-strong")!.decayFactor).toBeLessThan(0.4);
    });

    it("半減期付近での減衰を確認", () => {
      const now = 1000000;
      const halfLifeDays = calculateHalfLife(0.02);

      const edges = [
        { weight: 1.0, createdAt: now - 86400 * halfLifeDays },
      ];

      const withDecay = applyTimeDecayToEdges(edges, 0.02, now);

      // 半減期経過後は重みが約半分
      expect(withDecay[0].decayedWeight).toBeCloseTo(0.5, 1);
    });
  });
});
