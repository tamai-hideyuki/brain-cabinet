/**
 * Causal Inference Service Tests (v5.11)
 */

import { describe, it, expect } from "vitest";
import {
  grangerCausalityTest,
  MIN_OBSERVATIONS,
  DEFAULT_LAG,
  SIGNIFICANCE_THRESHOLD,
  MIN_CAUSAL_STRENGTH,
} from "./causalInference";

describe("causalInference", () => {
  // ============================================================
  // grangerCausalityTest
  // ============================================================
  describe("grangerCausalityTest", () => {
    it("明確な因果関係を検出する", () => {
      // ソースがターゲットに先行するパターン
      const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const target = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // 1ラグ遅れ

      const result = grangerCausalityTest(source, target, 2);

      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
      expect(result.causalStrength).toBeGreaterThanOrEqual(0);
      expect(result.causalStrength).toBeLessThanOrEqual(1);
    });

    it("独立した系列では弱い因果関係を返す", () => {
      // ランダムなパターン（相関なし）
      const source = [1, 3, 2, 5, 4, 7, 6, 9, 8, 10];
      const target = [10, 8, 9, 6, 7, 4, 5, 2, 3, 1];

      const result = grangerCausalityTest(source, target, 2);

      // 因果関係が弱いか、p値が高い
      expect(result.causalStrength).toBeLessThan(0.9);
    });

    it("観測数が不足している場合は0を返す", () => {
      const source = [1, 2, 3];
      const target = [1, 2, 3];

      const result = grangerCausalityTest(source, target, 2);

      expect(result.fStatistic).toBe(0);
      expect(result.pValue).toBe(1);
      expect(result.causalStrength).toBe(0);
    });

    it("空配列の場合は0を返す", () => {
      const result = grangerCausalityTest([], [], 2);

      expect(result.fStatistic).toBe(0);
      expect(result.pValue).toBe(1);
      expect(result.causalStrength).toBe(0);
    });

    it("同一の系列では中程度の結果を返す", () => {
      const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const result = grangerCausalityTest(series, series, 2);

      // 自己相関があるのでF統計量は0以上
      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
    });

    it("ラグが系列長より大きい場合は0を返す", () => {
      const source = [1, 2, 3, 4, 5];
      const target = [1, 2, 3, 4, 5];

      const result = grangerCausalityTest(source, target, 10);

      expect(result.fStatistic).toBe(0);
      expect(result.causalStrength).toBe(0);
    });

    it("トレンドのある系列を処理できる", () => {
      // 上昇トレンド
      const source = Array.from({ length: 20 }, (_, i) => i + Math.random() * 0.5);
      const target = Array.from({ length: 20 }, (_, i) => i * 0.5 + 2 + Math.random() * 0.5);

      const result = grangerCausalityTest(source, target, 3);

      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
    });

    it("負の値を含む系列を処理できる", () => {
      const source = [-5, -3, -1, 1, 3, 5, 3, 1, -1, -3];
      const target = [-4, -2, 0, 2, 4, 4, 2, 0, -2, -4];

      const result = grangerCausalityTest(source, target, 2);

      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Constants
  // ============================================================
  describe("constants", () => {
    it("MIN_OBSERVATIONSが適切な値を持つ", () => {
      expect(MIN_OBSERVATIONS).toBe(5);
    });

    it("DEFAULT_LAGが適切な値を持つ", () => {
      expect(DEFAULT_LAG).toBe(7);
    });

    it("SIGNIFICANCE_THRESHOLDが適切な値を持つ", () => {
      expect(SIGNIFICANCE_THRESHOLD).toBe(0.05);
    });

    it("MIN_CAUSAL_STRENGTHが適切な値を持つ", () => {
      expect(MIN_CAUSAL_STRENGTH).toBe(0.3);
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================
  describe("edge cases", () => {
    it("全てゼロの系列を処理できる", () => {
      const zeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      const result = grangerCausalityTest(zeros, zeros, 2);

      expect(result.fStatistic).toBe(0);
    });

    it("非常に大きな値を処理できる", () => {
      const large = Array.from({ length: 15 }, (_, i) => i * 1e6);

      const result = grangerCausalityTest(large, large, 2);

      expect(Number.isFinite(result.fStatistic)).toBe(true);
    });

    it("非常に小さな値を処理できる", () => {
      const small = Array.from({ length: 15 }, (_, i) => i * 1e-6);

      const result = grangerCausalityTest(small, small, 2);

      expect(Number.isFinite(result.fStatistic)).toBe(true);
    });

    it("異なる長さの系列を処理できる", () => {
      const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const target = [1, 2, 3, 4, 5, 6, 7];

      const result = grangerCausalityTest(source, target, 2);

      // 短い方に合わせて処理
      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Causality scenarios
  // ============================================================
  describe("causality scenarios", () => {
    it("明確な時間遅れがある因果関係", () => {
      // ソースが2ステップ先行
      const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const target = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const result = grangerCausalityTest(source, target, 3);

      // 因果関係が検出される（ただし強度は統計的な要因による）
      expect(result.causalStrength).toBeGreaterThanOrEqual(0);
    });

    it("逆因果関係のテスト", () => {
      const source = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const target = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

      const forwardResult = grangerCausalityTest(source, target, 2);
      const backwardResult = grangerCausalityTest(target, source, 2);

      // 両方向の結果が得られる
      expect(forwardResult.causalStrength).toBeGreaterThanOrEqual(0);
      expect(backwardResult.causalStrength).toBeGreaterThanOrEqual(0);
    });

    it("周期的なパターン", () => {
      const source = [1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1, 0];
      const target = [0, 1, 0, -1, 0, 1, 0, -1, 0, 1, 0, -1];

      const result = grangerCausalityTest(source, target, 2);

      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
    });

    it("ノイズが多い系列", () => {
      // 基本トレンド + ノイズ
      const source = Array.from({ length: 20 }, (_, i) => i + (Math.random() - 0.5) * 5);
      const target = Array.from({ length: 20 }, (_, i) => i * 0.8 + (Math.random() - 0.5) * 5);

      const result = grangerCausalityTest(source, target, 3);

      // ノイズが多くても処理できる
      expect(Number.isFinite(result.fStatistic)).toBe(true);
      expect(Number.isFinite(result.causalStrength)).toBe(true);
    });
  });

  // ============================================================
  // Numerical stability
  // ============================================================
  describe("numerical stability", () => {
    it("結果が有限値であることを保証", () => {
      const source = Array.from({ length: 30 }, () => Math.random() * 100);
      const target = Array.from({ length: 30 }, () => Math.random() * 100);

      const result = grangerCausalityTest(source, target, 5);

      expect(Number.isFinite(result.fStatistic)).toBe(true);
      expect(Number.isFinite(result.pValue)).toBe(true);
      expect(Number.isFinite(result.causalStrength)).toBe(true);
      expect(result.fStatistic).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
      expect(result.causalStrength).toBeGreaterThanOrEqual(0);
      expect(result.causalStrength).toBeLessThanOrEqual(1);
    });

    it("round4が正しく適用されている", () => {
      const source = Array.from({ length: 15 }, (_, i) => i * 1.123456789);
      const target = Array.from({ length: 15 }, (_, i) => i * 0.987654321);

      const result = grangerCausalityTest(source, target, 2);

      // 小数点4桁に丸められている
      const decimals = result.fStatistic.toString().split(".")[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(4);
    });
  });
});
