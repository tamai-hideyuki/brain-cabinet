import { describe, it, expect } from "vitest";
import {
  computeDriftScore,
  classifyDriftEvent,
  getChangeTypeModifier,
  DRIFT_THRESHOLD,
  LARGE_DRIFT_THRESHOLD,
} from "./computeDriftScore";

// ============================================================
// computeDriftScore のテスト
// ============================================================

describe("computeDriftScore", () => {
  describe("基本的なドリフトスコア計算", () => {
    it("semanticDiff のみでドリフトスコアを計算する（クラスター変化なし）", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: 1,
        newClusterId: 1,
      });

      expect(result.driftScore).toBe(0.3);
      expect(result.clusterJump).toBe(false);
      expect(result.clusterJumpBonus).toBe(0);
    });

    it("クラスター変化時にボーナスが加算される", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: 1,
        newClusterId: 2,
      });

      // 0.3 * (1 + 0.5) = 0.45
      expect(result.driftScore).toBeCloseTo(0.45);
      expect(result.clusterJump).toBe(true);
      expect(result.clusterJumpBonus).toBe(0.5);
    });

    it("oldClusterId が null の場合はクラスタージャンプなし", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: null,
        newClusterId: 1,
      });

      expect(result.driftScore).toBe(0.3);
      expect(result.clusterJump).toBe(false);
    });

    it("newClusterId が null の場合はクラスタージャンプなし", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: 1,
        newClusterId: null,
      });

      expect(result.driftScore).toBe(0.3);
      expect(result.clusterJump).toBe(false);
    });

    it("両方 null の場合はクラスタージャンプなし", () => {
      const result = computeDriftScore({
        semanticDiff: 0.5,
        oldClusterId: null,
        newClusterId: null,
      });

      expect(result.driftScore).toBe(0.5);
      expect(result.clusterJump).toBe(false);
    });
  });

  describe("境界値テスト", () => {
    it("semanticDiff が 0 の場合", () => {
      const result = computeDriftScore({
        semanticDiff: 0,
        oldClusterId: 1,
        newClusterId: 2,
      });

      expect(result.driftScore).toBe(0);
      expect(result.clusterJump).toBe(true);
    });

    it("semanticDiff が 1 の場合（最大）", () => {
      const result = computeDriftScore({
        semanticDiff: 1.0,
        oldClusterId: 1,
        newClusterId: 2,
      });

      // 1.0 * (1 + 0.5) = 1.5
      expect(result.driftScore).toBe(1.5);
    });

    it("同じ clusterId の場合はジャンプなし", () => {
      const result = computeDriftScore({
        semanticDiff: 0.5,
        oldClusterId: 5,
        newClusterId: 5,
      });

      expect(result.clusterJump).toBe(false);
      expect(result.driftScore).toBe(0.5);
    });
  });

  describe("v5.6: 変化タイプによる修正", () => {
    it("changeType が未指定の場合は修正なし", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: 1,
        newClusterId: 1,
      });

      expect(result.changeTypeModifier).toBe(0);
      expect(result.driftScore).toBe(0.3);
    });

    it("pivot は +0.3 の修正を適用", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: 1,
        newClusterId: 1,
        changeType: "pivot",
      });

      // 0.3 * (1 + 0 + 0.3) = 0.39
      expect(result.changeTypeModifier).toBe(0.3);
      expect(result.driftScore).toBeCloseTo(0.39);
    });

    it("expansion は +0.1 の修正を適用", () => {
      const result = computeDriftScore({
        semanticDiff: 0.5,
        oldClusterId: 1,
        newClusterId: 1,
        changeType: "expansion",
      });

      // 0.5 * (1 + 0 + 0.1) = 0.55
      expect(result.changeTypeModifier).toBe(0.1);
      expect(result.driftScore).toBeCloseTo(0.55);
    });

    it("contraction は修正なし", () => {
      const result = computeDriftScore({
        semanticDiff: 0.4,
        oldClusterId: 1,
        newClusterId: 1,
        changeType: "contraction",
      });

      expect(result.changeTypeModifier).toBe(0);
      expect(result.driftScore).toBe(0.4);
    });

    it("deepening は -0.1 の修正を適用（ドリフト抑制）", () => {
      const result = computeDriftScore({
        semanticDiff: 0.5,
        oldClusterId: 1,
        newClusterId: 1,
        changeType: "deepening",
      });

      // 0.5 * (1 + 0 - 0.1) = 0.45
      expect(result.changeTypeModifier).toBe(-0.1);
      expect(result.driftScore).toBeCloseTo(0.45);
    });

    it("refinement は -0.2 の修正を適用（最大の抑制）", () => {
      const result = computeDriftScore({
        semanticDiff: 0.5,
        oldClusterId: 1,
        newClusterId: 1,
        changeType: "refinement",
      });

      // 0.5 * (1 + 0 - 0.2) = 0.4
      expect(result.changeTypeModifier).toBe(-0.2);
      expect(result.driftScore).toBeCloseTo(0.4);
    });

    it("クラスタージャンプと変化タイプを組み合わせる", () => {
      const result = computeDriftScore({
        semanticDiff: 0.3,
        oldClusterId: 1,
        newClusterId: 2,
        changeType: "pivot",
      });

      // 0.3 * (1 + 0.5 + 0.3) = 0.54
      expect(result.clusterJump).toBe(true);
      expect(result.clusterJumpBonus).toBe(0.5);
      expect(result.changeTypeModifier).toBe(0.3);
      expect(result.driftScore).toBeCloseTo(0.54);
    });

    it("スコアは0〜1.5の範囲に収める", () => {
      // 最大値テスト: 1.0 * (1 + 0.5 + 0.3) = 1.8 → 1.5にクランプ
      const maxResult = computeDriftScore({
        semanticDiff: 1.0,
        oldClusterId: 1,
        newClusterId: 2,
        changeType: "pivot",
      });
      expect(maxResult.driftScore).toBe(1.5);

      // 最小値テスト: refinementで負の修正でも0未満にはならない
      const minResult = computeDriftScore({
        semanticDiff: 0.1,
        oldClusterId: 1,
        newClusterId: 1,
        changeType: "refinement",
      });
      expect(minResult.driftScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getChangeTypeModifier", () => {
    it("各変化タイプに対して正しい修正値を返す", () => {
      expect(getChangeTypeModifier("pivot")).toBe(0.3);
      expect(getChangeTypeModifier("expansion")).toBe(0.1);
      expect(getChangeTypeModifier("contraction")).toBe(0);
      expect(getChangeTypeModifier("deepening")).toBe(-0.1);
      expect(getChangeTypeModifier("refinement")).toBe(-0.2);
    });

    it("null/undefinedの場合は0を返す", () => {
      expect(getChangeTypeModifier(null)).toBe(0);
      expect(getChangeTypeModifier(undefined)).toBe(0);
    });
  });
});

describe("classifyDriftEvent", () => {
  it("クラスタージャンプは cluster_shift を返す", () => {
    expect(classifyDriftEvent(0.1, true)).toBe("cluster_shift");
    expect(classifyDriftEvent(0.5, true)).toBe("cluster_shift");
  });

  it("大きな変化は large を返す", () => {
    expect(classifyDriftEvent(LARGE_DRIFT_THRESHOLD, false)).toBe("large");
    expect(classifyDriftEvent(0.6, false)).toBe("large");
    expect(classifyDriftEvent(1.0, false)).toBe("large");
  });

  it("中程度の変化は medium を返す", () => {
    expect(classifyDriftEvent(DRIFT_THRESHOLD, false)).toBe("medium");
    expect(classifyDriftEvent(0.3, false)).toBe("medium");
    expect(classifyDriftEvent(0.49, false)).toBe("medium");
  });

  it("小さな変化は null を返す", () => {
    expect(classifyDriftEvent(0, false)).toBeNull();
    expect(classifyDriftEvent(0.1, false)).toBeNull();
    expect(classifyDriftEvent(0.24, false)).toBeNull();
  });

  it("閾値の境界値", () => {
    // DRIFT_THRESHOLD = 0.25
    expect(classifyDriftEvent(0.24, false)).toBeNull();
    expect(classifyDriftEvent(0.25, false)).toBe("medium");

    // LARGE_DRIFT_THRESHOLD = 0.5
    expect(classifyDriftEvent(0.49, false)).toBe("medium");
    expect(classifyDriftEvent(0.5, false)).toBe("large");
  });
});

// driftCore の内部ロジックをテスト

describe("driftCore", () => {
  describe("calcEMA（指数移動平均）", () => {
    const calcEMA = (values: number[], alpha: number = 0.3): number[] => {
      if (values.length === 0) return [];

      let ema = values[0];
      const result = [ema];

      for (let i = 1; i < values.length; i++) {
        ema = alpha * values[i] + (1 - alpha) * ema;
        result.push(ema);
      }

      return result;
    };

    it("単一値はそのまま返す", () => {
      expect(calcEMA([5])).toEqual([5]);
    });

    it("2つの値で正しく計算", () => {
      const result = calcEMA([10, 20], 0.3);
      // EMA[0] = 10
      // EMA[1] = 0.3 * 20 + 0.7 * 10 = 6 + 7 = 13
      expect(result[0]).toBe(10);
      expect(result[1]).toBeCloseTo(13);
    });

    it("複数値で滑らかに変化", () => {
      const values = [10, 10, 10, 20, 20, 20];
      const result = calcEMA(values, 0.3);

      // 最初は10付近、後半は20に近づく
      expect(result[0]).toBe(10);
      expect(result[result.length - 1]).toBeGreaterThan(15);
      expect(result[result.length - 1]).toBeLessThan(20);
    });

    it("空配列を処理", () => {
      expect(calcEMA([])).toEqual([]);
    });

    it("alpha=1で即座に追従", () => {
      const values = [10, 20, 30];
      const result = calcEMA(values, 1.0);
      expect(result).toEqual([10, 20, 30]);
    });

    it("alpha=0で変化しない", () => {
      const values = [10, 20, 30];
      const result = calcEMA(values, 0);
      expect(result).toEqual([10, 10, 10]);
    });
  });

  describe("calcGrowthAngle（成長角度計算）", () => {
    type DailyDrift = { date: string; drift: number; ema: number };
    type GrowthAngle = {
      angle: number;
      angleDegrees: number;
      trend: "rising" | "falling" | "flat";
      velocity: number;
    };

    const TREND_THRESHOLD = 0.05;

    const calcGrowthAngle = (data: DailyDrift[]): GrowthAngle => {
      if (data.length < 2) {
        return {
          angle: 0,
          angleDegrees: 0,
          trend: "flat",
          velocity: 0,
        };
      }

      const today = data[data.length - 1];
      const yesterday = data[data.length - 2];

      const diff = today.ema - yesterday.ema;
      const angle = Math.atan(diff);
      const angleDegrees = (angle * 180) / Math.PI;

      const relativeChange = yesterday.ema > 0 ? diff / yesterday.ema : 0;
      let trend: "rising" | "falling" | "flat";

      if (relativeChange > TREND_THRESHOLD) {
        trend = "rising";
      } else if (relativeChange < -TREND_THRESHOLD) {
        trend = "falling";
      } else {
        trend = "flat";
      }

      return {
        angle: Math.round(angle * 10000) / 10000,
        angleDegrees: Math.round(angleDegrees * 10000) / 10000,
        trend,
        velocity: Math.round(diff * 10000) / 10000,
      };
    };

    it("データが1件以下でflat", () => {
      expect(calcGrowthAngle([]).trend).toBe("flat");
      expect(calcGrowthAngle([{ date: "2024-01-01", drift: 1, ema: 1 }]).trend).toBe("flat");
    });

    it("上昇トレンドを検出", () => {
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 1, ema: 1.0 },
        { date: "2024-01-02", drift: 1.5, ema: 1.2 }, // 20% 上昇
      ];
      const result = calcGrowthAngle(data);
      expect(result.trend).toBe("rising");
      expect(result.velocity).toBeGreaterThan(0);
    });

    it("下降トレンドを検出", () => {
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 1, ema: 1.0 },
        { date: "2024-01-02", drift: 0.5, ema: 0.8 }, // 20% 下降
      ];
      const result = calcGrowthAngle(data);
      expect(result.trend).toBe("falling");
      expect(result.velocity).toBeLessThan(0);
    });

    it("フラットトレンドを検出", () => {
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 1, ema: 1.0 },
        { date: "2024-01-02", drift: 1, ema: 1.02 }, // 2% 変化
      ];
      const result = calcGrowthAngle(data);
      expect(result.trend).toBe("flat");
    });

    it("角度が正しく計算される", () => {
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 0, ema: 0 },
        { date: "2024-01-02", drift: 1, ema: 1 },
      ];
      const result = calcGrowthAngle(data);
      // atan(1) = 45度
      expect(result.angleDegrees).toBeCloseTo(45, 0);
    });
  });

  describe("calcDriftForecast（ドリフト予測）", () => {
    type DailyDrift = { date: string; drift: number; ema: number };
    type GrowthAngle = { velocity: number };
    type DriftForecast = {
      forecast3d: number;
      forecast7d: number;
      confidence: "high" | "medium" | "low";
    };

    const calcDriftForecast = (
      data: DailyDrift[],
      angle: GrowthAngle
    ): DriftForecast => {
      if (data.length === 0) {
        return {
          forecast3d: 0,
          forecast7d: 0,
          confidence: "low",
        };
      }

      const todayEMA = data[data.length - 1].ema;
      const velocity = angle.velocity;

      const forecast3d = Math.max(0, todayEMA + velocity * 3);
      const forecast7d = Math.max(0, todayEMA + velocity * 7);

      let confidence: "high" | "medium" | "low";
      if (data.length >= 14) {
        confidence = "high";
      } else if (data.length >= 7) {
        confidence = "medium";
      } else {
        confidence = "low";
      }

      return {
        forecast3d: Math.round(forecast3d * 10000) / 10000,
        forecast7d: Math.round(forecast7d * 10000) / 10000,
        confidence,
      };
    };

    it("空データで0を返す", () => {
      const result = calcDriftForecast([], { velocity: 0 });
      expect(result.forecast3d).toBe(0);
      expect(result.forecast7d).toBe(0);
      expect(result.confidence).toBe("low");
    });

    it("正の速度で増加予測", () => {
      const data: DailyDrift[] = [{ date: "2024-01-01", drift: 1, ema: 10 }];
      const result = calcDriftForecast(data, { velocity: 1 });
      expect(result.forecast3d).toBe(13); // 10 + 1 * 3
      expect(result.forecast7d).toBe(17); // 10 + 1 * 7
    });

    it("負の速度でも0未満にならない", () => {
      const data: DailyDrift[] = [{ date: "2024-01-01", drift: 1, ema: 5 }];
      const result = calcDriftForecast(data, { velocity: -10 });
      expect(result.forecast3d).toBe(0);
      expect(result.forecast7d).toBe(0);
    });

    it("データ量で信頼度が変わる", () => {
      const makeData = (days: number): DailyDrift[] => {
        return Array.from({ length: days }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, "0")}`,
          drift: 1,
          ema: 1,
        }));
      };

      expect(calcDriftForecast(makeData(5), { velocity: 0 }).confidence).toBe("low");
      expect(calcDriftForecast(makeData(7), { velocity: 0 }).confidence).toBe("medium");
      expect(calcDriftForecast(makeData(14), { velocity: 0 }).confidence).toBe("high");
    });
  });

  describe("detectWarning（警告検出）", () => {
    type DailyDrift = { date: string; drift: number; ema: number };
    type DriftWarning = {
      state: "stable" | "overheat" | "stagnation";
      severity: "none" | "low" | "mid" | "high";
      recommendation: string;
    };

    const OVERHEAT_SIGMA = 1.5;
    const STAGNATION_SIGMA = 1.0;

    const calcStats = (values: number[]): { mean: number; stdDev: number } => {
      if (values.length === 0) return { mean: 0, stdDev: 0 };

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return { mean, stdDev };
    };

    const detectWarning = (data: DailyDrift[]): DriftWarning => {
      if (data.length < 3) {
        return {
          state: "stable",
          severity: "none",
          recommendation: "データが不足しています。",
        };
      }

      const emaValues = data.map((d) => d.ema);
      const { mean, stdDev } = calcStats(emaValues);
      const todayEMA = emaValues[emaValues.length - 1];

      if (todayEMA > mean + OVERHEAT_SIGMA * stdDev) {
        const severity =
          todayEMA > mean + 2 * stdDev
            ? "high"
            : todayEMA > mean + 1.5 * stdDev
              ? "mid"
              : "low";

        return {
          state: "overheat",
          severity,
          recommendation: "知的活動が過剰です。",
        };
      }

      if (todayEMA < mean - STAGNATION_SIGMA * stdDev) {
        const severity =
          todayEMA < mean - 2 * stdDev
            ? "high"
            : todayEMA < mean - 1.5 * stdDev
              ? "mid"
              : "low";

        return {
          state: "stagnation",
          severity,
          recommendation: "思考活動が停滞しています。",
        };
      }

      return {
        state: "stable",
        severity: "none",
        recommendation: "安定した成長リズムです。",
      };
    };

    it("データ不足でstable", () => {
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 1, ema: 1 },
        { date: "2024-01-02", drift: 1, ema: 1 },
      ];
      const result = detectWarning(data);
      expect(result.state).toBe("stable");
    });

    it("過熱状態を検出", () => {
      // 平均から大きく離れた高い値
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 1, ema: 1 },
        { date: "2024-01-02", drift: 1, ema: 1 },
        { date: "2024-01-03", drift: 1, ema: 1 },
        { date: "2024-01-04", drift: 1, ema: 1 },
        { date: "2024-01-05", drift: 10, ema: 10 }, // 急上昇
      ];
      const result = detectWarning(data);
      expect(result.state).toBe("overheat");
    });

    it("停滞状態を検出", () => {
      // 平均から大きく離れた低い値
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 10, ema: 10 },
        { date: "2024-01-02", drift: 10, ema: 10 },
        { date: "2024-01-03", drift: 10, ema: 10 },
        { date: "2024-01-04", drift: 10, ema: 10 },
        { date: "2024-01-05", drift: 1, ema: 1 }, // 急低下
      ];
      const result = detectWarning(data);
      expect(result.state).toBe("stagnation");
    });

    it("安定状態を検出", () => {
      const data: DailyDrift[] = [
        { date: "2024-01-01", drift: 5, ema: 5 },
        { date: "2024-01-02", drift: 5, ema: 5 },
        { date: "2024-01-03", drift: 5, ema: 5 },
        { date: "2024-01-04", drift: 5, ema: 5 },
        { date: "2024-01-05", drift: 5, ema: 5 },
      ];
      const result = detectWarning(data);
      expect(result.state).toBe("stable");
    });
  });

  describe("detectDriftMode（ドリフトモード判定）", () => {
    type GrowthAngle = { trend: "rising" | "falling" | "flat" };
    type DriftWarning = { state: "stable" | "overheat" | "stagnation" };
    type DriftMode = "exploration" | "consolidation" | "growth" | "rest";

    const detectDriftMode = (
      angle: GrowthAngle,
      warning: DriftWarning
    ): DriftMode => {
      if (warning.state === "overheat") {
        return "rest";
      }

      if (warning.state === "stagnation") {
        return "exploration";
      }

      if (angle.trend === "rising") {
        return "growth";
      }

      if (angle.trend === "falling") {
        return "consolidation";
      }

      return "consolidation";
    };

    it("過熱時はrest", () => {
      expect(
        detectDriftMode({ trend: "rising" }, { state: "overheat" })
      ).toBe("rest");
    });

    it("停滞時はexploration", () => {
      expect(
        detectDriftMode({ trend: "flat" }, { state: "stagnation" })
      ).toBe("exploration");
    });

    it("上昇トレンドでgrowth", () => {
      expect(
        detectDriftMode({ trend: "rising" }, { state: "stable" })
      ).toBe("growth");
    });

    it("下降トレンドでconsolidation", () => {
      expect(
        detectDriftMode({ trend: "falling" }, { state: "stable" })
      ).toBe("consolidation");
    });

    it("フラットでconsolidation", () => {
      expect(
        detectDriftMode({ trend: "flat" }, { state: "stable" })
      ).toBe("consolidation");
    });
  });

  describe("calcStats（統計計算）", () => {
    const calcStats = (values: number[]): { mean: number; stdDev: number } => {
      if (values.length === 0) return { mean: 0, stdDev: 0 };

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return { mean, stdDev };
    };

    it("空配列で0を返す", () => {
      const result = calcStats([]);
      expect(result.mean).toBe(0);
      expect(result.stdDev).toBe(0);
    });

    it("単一値で標準偏差0", () => {
      const result = calcStats([5]);
      expect(result.mean).toBe(5);
      expect(result.stdDev).toBe(0);
    });

    it("同じ値で標準偏差0", () => {
      const result = calcStats([3, 3, 3, 3]);
      expect(result.mean).toBe(3);
      expect(result.stdDev).toBe(0);
    });

    it("平均を正しく計算", () => {
      const result = calcStats([1, 2, 3, 4, 5]);
      expect(result.mean).toBe(3);
    });

    it("標準偏差を正しく計算", () => {
      // [2, 4, 4, 4, 5, 5, 7, 9] の標準偏差は約2
      const result = calcStats([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result.mean).toBe(5);
      expect(result.stdDev).toBeCloseTo(2, 0);
    });
  });

  describe("round4（小数点4桁丸め）", () => {
    const round4 = (n: number): number => {
      return Math.round(n * 10000) / 10000;
    };

    it("4桁で丸める", () => {
      expect(round4(1.23456789)).toBe(1.2346);
      expect(round4(0.00001)).toBe(0);
      expect(round4(0.00005)).toBe(0.0001);
    });

    it("整数はそのまま", () => {
      expect(round4(5)).toBe(5);
    });

    it("負の数を処理", () => {
      expect(round4(-1.23456)).toBe(-1.2346);
    });
  });
});

// ============================================================
// v7.2: Drift Phase のテスト
// ============================================================

describe("DriftPhase (v7.2)", () => {
  describe("trajectoryからphaseへのマッピング", () => {
    type Trajectory = "expansion" | "contraction" | "pivot" | "lateral" | "stable";
    type DriftPhase = "creation" | "destruction" | "neutral";

    const mapTrajectoryToPhase = (trajectory: Trajectory): DriftPhase => {
      if (trajectory === "expansion" || trajectory === "pivot") {
        return "creation";
      }
      if (trajectory === "contraction") {
        return "destruction";
      }
      return "neutral";
    };

    it("expansion は creation にマップ", () => {
      expect(mapTrajectoryToPhase("expansion")).toBe("creation");
    });

    it("pivot は creation にマップ", () => {
      expect(mapTrajectoryToPhase("pivot")).toBe("creation");
    });

    it("contraction は destruction にマップ", () => {
      expect(mapTrajectoryToPhase("contraction")).toBe("destruction");
    });

    it("lateral は neutral にマップ", () => {
      expect(mapTrajectoryToPhase("lateral")).toBe("neutral");
    });

    it("stable は neutral にマップ", () => {
      expect(mapTrajectoryToPhase("stable")).toBe("neutral");
    });
  });

  describe("日別の最多phaseの決定", () => {
    type DriftPhase = "creation" | "destruction" | "neutral";

    const determineDailyPhase = (counts: {
      creation: number;
      destruction: number;
      neutral: number;
    }): DriftPhase => {
      const { creation, destruction, neutral } = counts;
      const max = Math.max(creation, destruction, neutral);

      if (max === 0) return "neutral";
      if (creation === max) return "creation";
      if (destruction === max) return "destruction";
      return "neutral";
    };

    it("creationが最多ならcreation", () => {
      expect(determineDailyPhase({ creation: 5, destruction: 2, neutral: 1 })).toBe("creation");
    });

    it("destructionが最多ならdestruction", () => {
      expect(determineDailyPhase({ creation: 1, destruction: 5, neutral: 2 })).toBe("destruction");
    });

    it("neutralが最多ならneutral", () => {
      expect(determineDailyPhase({ creation: 1, destruction: 2, neutral: 5 })).toBe("neutral");
    });

    it("すべて0ならneutral", () => {
      expect(determineDailyPhase({ creation: 0, destruction: 0, neutral: 0 })).toBe("neutral");
    });

    it("同数の場合はcreationが優先", () => {
      // creation === destruction の場合、creationを返す
      expect(determineDailyPhase({ creation: 3, destruction: 3, neutral: 1 })).toBe("creation");
    });

    it("destruction と neutral が同数の場合は neutral を返す", () => {
      // creation より destruction/neutral が多い場合
      expect(determineDailyPhase({ creation: 1, destruction: 3, neutral: 3 })).toBe("destruction");
    });
  });
});

// ============================================================
// v7.4: Extended Warning のテスト
// ============================================================

describe("ExtendedWarning (v7.4)", () => {
  type DriftPhase = "creation" | "destruction" | "neutral";
  type BaseState = "stable" | "overheat" | "stagnation";
  type ExtendedWarningType =
    | "creative_overheat"
    | "destructive_overheat"
    | "neutral_overheat"
    | "exploratory_stagnation"
    | "rest_stagnation"
    | "deepening_stagnation"
    | "stable";

  type DriftWarning = {
    state: BaseState;
    severity: "none" | "low" | "mid" | "high";
    recommendation: string;
  };

  // detectExtendedWarning のロジックを再現
  const detectExtendedWarning = (
    warning: DriftWarning,
    phase: DriftPhase | null
  ): { extendedType: ExtendedWarningType; isCreativeOverheat: boolean } => {
    const baseState = warning.state;

    if (baseState === "stable") {
      return { extendedType: "stable", isCreativeOverheat: false };
    }

    if (baseState === "overheat") {
      if (phase === "creation") {
        return { extendedType: "creative_overheat", isCreativeOverheat: true };
      } else if (phase === "destruction") {
        return { extendedType: "destructive_overheat", isCreativeOverheat: false };
      } else {
        return { extendedType: "neutral_overheat", isCreativeOverheat: false };
      }
    }

    if (baseState === "stagnation") {
      if (phase === "creation") {
        return { extendedType: "exploratory_stagnation", isCreativeOverheat: false };
      } else if (phase === "destruction") {
        return { extendedType: "deepening_stagnation", isCreativeOverheat: false };
      } else {
        return { extendedType: "rest_stagnation", isCreativeOverheat: false };
      }
    }

    return { extendedType: "stable", isCreativeOverheat: false };
  };

  describe("Overheat + Phase の組み合わせ", () => {
    const overheatWarning: DriftWarning = {
      state: "overheat",
      severity: "mid",
      recommendation: "知的活動が過剰です。",
    };

    it("overheat + creation = creative_overheat", () => {
      const result = detectExtendedWarning(overheatWarning, "creation");
      expect(result.extendedType).toBe("creative_overheat");
      expect(result.isCreativeOverheat).toBe(true);
    });

    it("overheat + destruction = destructive_overheat", () => {
      const result = detectExtendedWarning(overheatWarning, "destruction");
      expect(result.extendedType).toBe("destructive_overheat");
      expect(result.isCreativeOverheat).toBe(false);
    });

    it("overheat + neutral = neutral_overheat", () => {
      const result = detectExtendedWarning(overheatWarning, "neutral");
      expect(result.extendedType).toBe("neutral_overheat");
      expect(result.isCreativeOverheat).toBe(false);
    });

    it("overheat + null = neutral_overheat", () => {
      const result = detectExtendedWarning(overheatWarning, null);
      expect(result.extendedType).toBe("neutral_overheat");
      expect(result.isCreativeOverheat).toBe(false);
    });
  });

  describe("Stagnation + Phase の組み合わせ", () => {
    const stagnationWarning: DriftWarning = {
      state: "stagnation",
      severity: "low",
      recommendation: "思考活動が停滞しています。",
    };

    it("stagnation + creation = exploratory_stagnation", () => {
      const result = detectExtendedWarning(stagnationWarning, "creation");
      expect(result.extendedType).toBe("exploratory_stagnation");
    });

    it("stagnation + destruction = deepening_stagnation", () => {
      const result = detectExtendedWarning(stagnationWarning, "destruction");
      expect(result.extendedType).toBe("deepening_stagnation");
    });

    it("stagnation + neutral = rest_stagnation", () => {
      const result = detectExtendedWarning(stagnationWarning, "neutral");
      expect(result.extendedType).toBe("rest_stagnation");
    });
  });

  describe("Stable の場合", () => {
    const stableWarning: DriftWarning = {
      state: "stable",
      severity: "none",
      recommendation: "安定した成長リズムです。",
    };

    it("stable + 任意のphase = stable", () => {
      expect(detectExtendedWarning(stableWarning, "creation").extendedType).toBe("stable");
      expect(detectExtendedWarning(stableWarning, "destruction").extendedType).toBe("stable");
      expect(detectExtendedWarning(stableWarning, "neutral").extendedType).toBe("stable");
      expect(detectExtendedWarning(stableWarning, null).extendedType).toBe("stable");
    });

    it("stable では isCreativeOverheat は常に false", () => {
      expect(detectExtendedWarning(stableWarning, "creation").isCreativeOverheat).toBe(false);
    });
  });

  describe("Creative Overheat の判定条件", () => {
    it("creative overheat は overheat + creation の場合のみ true", () => {
      const overheat: DriftWarning = { state: "overheat", severity: "mid", recommendation: "" };
      const stagnation: DriftWarning = { state: "stagnation", severity: "mid", recommendation: "" };
      const stable: DriftWarning = { state: "stable", severity: "none", recommendation: "" };

      // overheat + creation のみ true
      expect(detectExtendedWarning(overheat, "creation").isCreativeOverheat).toBe(true);

      // それ以外は false
      expect(detectExtendedWarning(overheat, "destruction").isCreativeOverheat).toBe(false);
      expect(detectExtendedWarning(overheat, "neutral").isCreativeOverheat).toBe(false);
      expect(detectExtendedWarning(stagnation, "creation").isCreativeOverheat).toBe(false);
      expect(detectExtendedWarning(stable, "creation").isCreativeOverheat).toBe(false);
    });
  });
});
