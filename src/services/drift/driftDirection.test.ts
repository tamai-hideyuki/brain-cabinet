/**
 * Drift Direction Service Tests (v5.10)
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from "vitest";
import {
  calculateDriftVector,
  calculateClusterAlignments,
  determineTrajectory,
  MIN_DRIFT_SCORE,
  SIGNIFICANT_ALIGNMENT,
  type DriftVector,
  type ClusterAlignment,
  type DriftDirection,
} from "./driftDirection";

describe("driftDirection", () => {
  // ============================================================
  // calculateDriftVector
  // ============================================================
  describe("calculateDriftVector", () => {
    it("正しくドリフトベクトルを計算する", () => {
      const oldEmb = [1, 0, 0];
      const newEmb = [0, 1, 0];
      const result = calculateDriftVector(oldEmb, newEmb);

      // diff = [-1, 1, 0]
      // magnitude = sqrt(1 + 1) = sqrt(2) ≈ 1.4142
      expect(result.magnitude).toBeCloseTo(1.4142, 3);

      // normalized = [-1/sqrt(2), 1/sqrt(2), 0]
      expect(result.vector.length).toBe(3);
      expect(result.vector[0]).toBeCloseTo(-0.7071, 3);
      expect(result.vector[1]).toBeCloseTo(0.7071, 3);
      expect(result.vector[2]).toBeCloseTo(0, 3);
    });

    it("同じベクトルの場合はゼロベクトルを返す", () => {
      const emb = [1, 0, 0];
      const result = calculateDriftVector(emb, emb);

      expect(result.magnitude).toBe(0);
      expect(result.vector).toEqual([0, 0, 0]);
    });

    it("空配列の場合は空を返す", () => {
      const result = calculateDriftVector([], []);
      expect(result.magnitude).toBe(0);
      expect(result.vector).toEqual([]);
    });

    it("長さが異なる配列の場合は空を返す", () => {
      const result = calculateDriftVector([1, 0], [1, 0, 0]);
      expect(result.magnitude).toBe(0);
      expect(result.vector).toEqual([]);
    });

    it("大きな変化を正しく計算する", () => {
      const oldEmb = [0, 0, 0];
      const newEmb = [3, 4, 0];
      const result = calculateDriftVector(oldEmb, newEmb);

      // magnitude = sqrt(9 + 16) = 5
      expect(result.magnitude).toBe(5);
      // normalized = [3/5, 4/5, 0]
      expect(result.vector[0]).toBeCloseTo(0.6, 3);
      expect(result.vector[1]).toBeCloseTo(0.8, 3);
    });
  });

  // ============================================================
  // calculateClusterAlignments
  // ============================================================
  describe("calculateClusterAlignments", () => {
    it("ドリフトベクトルとセントロイドのアラインメントを計算する", () => {
      // ドリフト方向: [1, 0, 0]（x軸正方向）
      const driftVector = [1, 0, 0];

      // クラスターセントロイド
      const centroids = new Map([
        [1, { centroid: [1, 0, 0] }],    // 同じ方向 → +1.0
        [2, { centroid: [-1, 0, 0] }],   // 反対方向 → -1.0
        [3, { centroid: [0, 1, 0] }],    // 直交 → 0.0
      ]);

      const result = calculateClusterAlignments(driftVector, centroids);

      expect(result.length).toBe(3);

      // ソート済み（alignment 降順）
      expect(result[0].clusterId).toBe(1);
      expect(result[0].alignment).toBeCloseTo(1, 3);
      expect(result[0].isApproaching).toBe(true);

      expect(result[1].clusterId).toBe(3);
      expect(result[1].alignment).toBeCloseTo(0, 3);
      expect(result[1].isApproaching).toBe(false);

      expect(result[2].clusterId).toBe(2);
      expect(result[2].alignment).toBeCloseTo(-1, 3);
      expect(result[2].isApproaching).toBe(false);
    });

    it("空のドリフトベクトルの場合は空配列を返す", () => {
      const centroids = new Map([[1, { centroid: [1, 0, 0] }]]);
      const result = calculateClusterAlignments([], centroids);
      expect(result).toEqual([]);
    });

    it("空のセントロイドマップの場合は空配列を返す", () => {
      const result = calculateClusterAlignments([1, 0, 0], new Map());
      expect(result).toEqual([]);
    });

    it("クラスター名を含む場合は正しく返す", () => {
      const driftVector = [1, 0, 0];
      const centroids = new Map([
        [1, { centroid: [1, 0, 0], name: "Technology" }],
      ]);

      const result = calculateClusterAlignments(driftVector, centroids);
      expect(result[0].clusterName).toBe("Technology");
    });
  });

  // ============================================================
  // determineTrajectory
  // ============================================================
  describe("determineTrajectory", () => {
    it("変化が小さい場合はstableを返す", () => {
      expect(determineTrajectory(0.05, 0.01, 0.8, false)).toBe("stable");
      expect(determineTrajectory(0.1, 0.03, 0.8, false)).toBe("stable");
    });

    it("クラスター変更がある場合はpivotを返す", () => {
      expect(determineTrajectory(0.5, 0.3, 0.5, true)).toBe("pivot");
    });

    it("強いポジティブアラインメントの場合はexpansionを返す", () => {
      expect(determineTrajectory(0.5, 0.3, 0.5, false)).toBe("expansion");
      expect(determineTrajectory(0.3, 0.2, 0.4, false)).toBe("expansion");
    });

    it("強いネガティブアラインメントの場合はcontractionを返す", () => {
      expect(determineTrajectory(0.5, 0.3, -0.5, false)).toBe("contraction");
      expect(determineTrajectory(0.3, 0.2, -0.4, false)).toBe("contraction");
    });

    it("中立的なアラインメントの場合はlateralを返す", () => {
      expect(determineTrajectory(0.5, 0.3, 0.1, false)).toBe("lateral");
      expect(determineTrajectory(0.5, 0.3, -0.1, false)).toBe("lateral");
      expect(determineTrajectory(0.5, 0.3, null, false)).toBe("lateral");
    });
  });

  // ============================================================
  // Constants
  // ============================================================
  describe("constants", () => {
    it("MIN_DRIFT_SCOREが適切な値を持つ", () => {
      expect(MIN_DRIFT_SCORE).toBe(0.1);
    });

    it("SIGNIFICANT_ALIGNMENTが適切な値を持つ", () => {
      expect(SIGNIFICANT_ALIGNMENT).toBe(0.3);
    });
  });

  // ============================================================
  // Integration scenarios（pure function tests）
  // ============================================================
  describe("integration scenarios", () => {
    it("拡張シナリオ: テクノロジークラスターに向かう変化", () => {
      // 初期: 一般的な位置
      const oldEmb = [0.5, 0.5, 0];
      // 変化後: テクノロジー方向（x軸）に移動
      const newEmb = [0.9, 0.5, 0];

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      const centroids = new Map([
        [1, { centroid: [1, 0, 0], name: "Technology" }],
        [2, { centroid: [0, 1, 0], name: "Art" }],
        [3, { centroid: [-1, 0, 0], name: "Nature" }],
      ]);

      const alignments = calculateClusterAlignments(vector, centroids);

      // テクノロジークラスターに最も近づいている
      expect(alignments[0].clusterId).toBe(1);
      expect(alignments[0].clusterName).toBe("Technology");
      expect(alignments[0].isApproaching).toBe(true);

      // 自然クラスターから最も離れている
      expect(alignments[alignments.length - 1].clusterId).toBe(3);
      expect(alignments[alignments.length - 1].isApproaching).toBe(false);

      const trajectory = determineTrajectory(
        0.4,
        magnitude,
        alignments[0].alignment,
        false
      );
      expect(trajectory).toBe("expansion");
    });

    it("ピボットシナリオ: クラスター間の移動", () => {
      const oldEmb = [0.8, 0.2, 0];
      const newEmb = [0.2, 0.8, 0];

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      const centroids = new Map([
        [1, { centroid: [1, 0, 0] }],
        [2, { centroid: [0, 1, 0] }],
      ]);

      const alignments = calculateClusterAlignments(vector, centroids);

      // クラスター2に向かっている
      expect(alignments[0].clusterId).toBe(2);
      expect(alignments[0].isApproaching).toBe(true);

      // クラスター変更があるのでpivot
      const trajectory = determineTrajectory(
        0.6,
        magnitude,
        alignments[0].alignment,
        true  // クラスター変更あり
      );
      expect(trajectory).toBe("pivot");
    });

    it("収縮シナリオ: 特定方向から離れる変化", () => {
      const oldEmb = [0.8, 0.1, 0.1];
      const newEmb = [0.3, 0.1, 0.1];

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      const centroids = new Map([
        [1, { centroid: [1, 0, 0] }],  // x方向のクラスター
      ]);

      const alignments = calculateClusterAlignments(vector, centroids);

      // x方向クラスターから離れている（負のアラインメント）
      expect(alignments[0].alignment).toBeLessThan(0);
      expect(alignments[0].isApproaching).toBe(false);

      const trajectory = determineTrajectory(
        0.5,
        magnitude,
        alignments[0].alignment,
        false
      );
      expect(trajectory).toBe("contraction");
    });

    it("横方向シナリオ: 新領域への探索", () => {
      const oldEmb = [0.5, 0, 0];
      const newEmb = [0.5, 0, 0.5];

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      const centroids = new Map([
        [1, { centroid: [1, 0, 0] }],  // x方向
        [2, { centroid: [0, 1, 0] }],  // y方向
      ]);

      const alignments = calculateClusterAlignments(vector, centroids);

      // z方向に動いているので両クラスターとの関連が弱い
      alignments.forEach(a => {
        expect(Math.abs(a.alignment)).toBeLessThan(SIGNIFICANT_ALIGNMENT);
      });

      const trajectory = determineTrajectory(
        0.5,
        magnitude,
        alignments[0].alignment,
        false
      );
      expect(trajectory).toBe("lateral");
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================
  describe("edge cases", () => {
    it("非常に小さな変化を正しく処理する", () => {
      const oldEmb = [1, 0, 0];
      const newEmb = [1.001, 0.001, 0];

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      expect(magnitude).toBeLessThan(0.01);
      expect(vector.length).toBe(3);
    });

    it("単位ベクトルの変化を正しく処理する", () => {
      // 正規化済みの単位ベクトル
      const oldEmb = [1, 0, 0];
      const newEmb = [0, 1, 0];

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      // 90度回転の場合、magnitude = sqrt(2)
      expect(magnitude).toBeCloseTo(1.4142, 3);
    });

    it("高次元ベクトルを正しく処理する", () => {
      const dim = 384;  // 一般的な埋め込み次元
      const oldEmb = new Array(dim).fill(0).map((_, i) => i / dim);
      const newEmb = new Array(dim).fill(0).map((_, i) => (dim - i) / dim);

      const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

      expect(vector.length).toBe(dim);
      expect(magnitude).toBeGreaterThan(0);
    });
  });
});
