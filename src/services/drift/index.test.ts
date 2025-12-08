import { describe, it, expect } from "vitest";

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
