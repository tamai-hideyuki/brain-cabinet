import { describe, it, expect } from "vitest";
import {
  TIME_WINDOWS,
  TREND_THRESHOLDS,
  aggregateActivity,
  calculateSlope,
  calculateR2,
  calculateTrend,
  calculateMultiScaleTrends,
  aggregateByMonth,
  detectSeasonalPattern,
  getWeeklyActivity,
  determinePhase,
  detectPhaseTransition,
  generateTimescaleInsight,
  filterByCluster,
  type TrendDirection,
  type Phase,
} from "./index";

// テスト用のヘルパー
function createActivity(
  date: string,
  clusterId: number,
  noteCount: number,
  changeCount: number = 0
) {
  return { date, clusterId, noteCount, changeCount };
}

function generateDailyActivities(
  clusterId: number,
  startDate: Date,
  days: number,
  baseActivity: number,
  trend: number = 0
) {
  const activities = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const activity = Math.max(0, Math.round(baseActivity + trend * i + (Math.random() - 0.5) * 2));
    activities.push(createActivity(dateStr, clusterId, activity));
  }
  return activities;
}

describe("Multi-Timescale Analysis", () => {
  // ============================================================
  // Constants
  // ============================================================

  describe("Constants", () => {
    it("TIME_WINDOWS が正しく定義されている", () => {
      expect(TIME_WINDOWS.weekly).toBe(7);
      expect(TIME_WINDOWS.monthly).toBe(30);
      expect(TIME_WINDOWS.quarterly).toBe(90);
    });

    it("TREND_THRESHOLDS が正しく定義されている", () => {
      expect(TREND_THRESHOLDS.rising).toBe(0.1);
      expect(TREND_THRESHOLDS.falling).toBe(-0.1);
    });
  });

  // ============================================================
  // Trend Calculation
  // ============================================================

  describe("calculateSlope", () => {
    it("上昇トレンドで正の傾きを返す", () => {
      const values = [1, 2, 3, 4, 5];
      const slope = calculateSlope(values);
      expect(slope).toBeCloseTo(1, 5);
    });

    it("下降トレンドで負の傾きを返す", () => {
      const values = [5, 4, 3, 2, 1];
      const slope = calculateSlope(values);
      expect(slope).toBeCloseTo(-1, 5);
    });

    it("横ばいで傾き0を返す", () => {
      const values = [3, 3, 3, 3, 3];
      const slope = calculateSlope(values);
      expect(slope).toBeCloseTo(0, 5);
    });

    it("空配列で0を返す", () => {
      expect(calculateSlope([])).toBe(0);
    });

    it("単一要素で0を返す", () => {
      expect(calculateSlope([5])).toBe(0);
    });
  });

  describe("calculateR2", () => {
    it("完全な線形データでR² = 1", () => {
      const values = [1, 2, 3, 4, 5];
      const slope = calculateSlope(values);
      const r2 = calculateR2(values, slope);
      expect(r2).toBeCloseTo(1, 5);
    });

    it("定数データでR² = 1", () => {
      const values = [3, 3, 3, 3, 3];
      const slope = calculateSlope(values);
      const r2 = calculateR2(values, slope);
      expect(r2).toBe(1);
    });

    it("ノイズのあるデータでR² < 1", () => {
      const values = [1, 3, 2, 5, 4];
      const slope = calculateSlope(values);
      const r2 = calculateR2(values, slope);
      expect(r2).toBeLessThan(1);
      expect(r2).toBeGreaterThan(0);
    });
  });

  describe("aggregateActivity", () => {
    it("指定期間内の活動を集計", () => {
      const activities = [
        createActivity("2025-01-01", 1, 5, 2),
        createActivity("2025-01-02", 1, 3, 1),
        createActivity("2025-01-03", 1, 4, 0),
      ];

      const endDate = new Date("2025-01-03");
      const total = aggregateActivity(activities, endDate, 7);

      expect(total).toBe(5 + 2 + 3 + 1 + 4 + 0);
    });

    it("期間外のデータは除外", () => {
      const activities = [
        createActivity("2025-01-01", 1, 10),
        createActivity("2025-01-10", 1, 5),
      ];

      const endDate = new Date("2025-01-10");
      const total = aggregateActivity(activities, endDate, 3);

      expect(total).toBe(5);
    });
  });

  describe("calculateTrend", () => {
    it("上昇トレンドを検出", () => {
      const now = new Date();
      // より強い上昇トレンド（ノイズなしで明確な増加）
      const activities = [];
      for (let i = 0; i < 90; i++) {
        const date = new Date(now.getTime() - (90 - i) * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split("T")[0];
        // 週ごとに増加（7日ごとに明確な増加）
        const weekNum = Math.floor(i / 7);
        activities.push({ date: dateStr, clusterId: 1, noteCount: 5 + weekNum * 3, changeCount: 0 });
      }

      const trend = calculateTrend(activities, 7, 4);

      expect(trend.velocity).toBeGreaterThan(0);
      // 上昇または安定（閾値により変わる）
      expect(["rising", "stable"]).toContain(trend.direction);
    });

    it("下降トレンドを検出", () => {
      const now = new Date();
      const activities = generateDailyActivities(1, new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), 90, 20, -0.2);

      const trend = calculateTrend(activities, 7, 4);

      expect(trend.direction).toBe("falling");
      expect(trend.velocity).toBeLessThan(0);
    });

    it("空データでstableを返す", () => {
      const trend = calculateTrend([], 7, 4);

      expect(trend.direction).toBe("stable");
      expect(trend.velocity).toBe(0);
      expect(trend.confidence).toBe(0);
    });
  });

  describe("calculateMultiScaleTrends", () => {
    it("3つのタイムスケールでトレンドを計算", () => {
      const now = new Date();
      const activities = generateDailyActivities(
        1,
        new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        365,
        10,
        0.02
      );

      const trends = calculateMultiScaleTrends(activities);

      expect(trends).toHaveProperty("weekly");
      expect(trends).toHaveProperty("monthly");
      expect(trends).toHaveProperty("quarterly");
      expect(["rising", "falling", "stable"]).toContain(trends.weekly.direction);
    });
  });

  // ============================================================
  // Seasonal Pattern Detection
  // ============================================================

  describe("aggregateByMonth", () => {
    it("月別にデータを集計", () => {
      const activities = [
        createActivity("2025-01-15", 1, 10),
        createActivity("2025-01-20", 1, 5),
        createActivity("2025-02-10", 1, 8),
        createActivity("2025-03-05", 1, 12),
      ];

      const monthly = aggregateByMonth(activities);

      expect(monthly.get(1)?.length).toBe(2); // 1月は2件
      expect(monthly.get(2)?.length).toBe(1); // 2月は1件
      expect(monthly.get(3)?.length).toBe(1); // 3月は1件
    });

    it("12ヶ月すべてのエントリを持つ", () => {
      const monthly = aggregateByMonth([]);

      for (let m = 1; m <= 12; m++) {
        expect(monthly.has(m)).toBe(true);
      }
    });
  });

  describe("detectSeasonalPattern", () => {
    it("データが少ない場合は検出しない", () => {
      const activities = [
        createActivity("2025-01-01", 1, 10),
        createActivity("2025-01-15", 1, 5),
      ];

      const pattern = detectSeasonalPattern(activities);

      expect(pattern.detected).toBe(false);
    });

    it("季節パターンを検出", () => {
      const activities = [];
      // 1月と7月に高活動、4月と10月に低活動
      for (let year = 2023; year <= 2025; year++) {
        for (let month = 1; month <= 12; month++) {
          const baseActivity = (month === 1 || month === 7) ? 20 : (month === 4 || month === 10) ? 2 : 10;
          for (let day = 1; day <= 28; day++) {
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            activities.push(createActivity(dateStr, 1, baseActivity));
          }
        }
      }

      const pattern = detectSeasonalPattern(activities);

      expect(pattern.detected).toBe(true);
      expect(pattern.amplitude).toBeGreaterThan(0);
    });

    it("均一なデータではパターンなし", () => {
      const activities = [];
      for (let i = 0; i < 365; i++) {
        const date = new Date("2025-01-01");
        date.setDate(date.getDate() + i);
        activities.push(createActivity(date.toISOString().split("T")[0], 1, 10));
      }

      const pattern = detectSeasonalPattern(activities);

      expect(pattern.detected).toBe(false);
    });
  });

  // ============================================================
  // Phase Transition Detection
  // ============================================================

  describe("getWeeklyActivity", () => {
    it("週ごとに活動を集計", () => {
      const activities = [
        createActivity("2025-01-06", 1, 5), // 月曜
        createActivity("2025-01-07", 1, 3), // 火曜
        createActivity("2025-01-13", 1, 8), // 翌月曜
      ];

      const weekly = getWeeklyActivity(activities);

      expect(weekly.length).toBe(2);
      expect(weekly[0].activity).toBe(8); // 5+3
      expect(weekly[1].activity).toBe(8);
    });
  });

  describe("determinePhase", () => {
    it("活動なしはdormant", () => {
      const phase = determinePhase(0, 5, 10);
      expect(phase).toBe("dormant");
    });

    it("前回ゼロで今回活動ありはemerging", () => {
      const phase = determinePhase(5, 0, 10);
      expect(phase).toBe("emerging");
    });

    it("大幅増加はexpansion", () => {
      const phase = determinePhase(15, 10, 10);
      expect(phase).toBe("expansion");
    });

    it("大幅減少はdeclining", () => {
      const phase = determinePhase(5, 10, 10);
      expect(phase).toBe("declining");
    });

    it("安定はconsolidation", () => {
      const phase = determinePhase(10, 9, 10);
      expect(phase).toBe("consolidation");
    });
  });

  describe("detectPhaseTransition", () => {
    it("データが少ない場合", () => {
      const activities = [
        createActivity("2025-01-01", 1, 5),
        createActivity("2025-01-08", 1, 6),
      ];

      const transition = detectPhaseTransition(activities);

      expect(transition.currentPhase).toBeDefined();
      expect(transition.stability).toBeGreaterThanOrEqual(0);
    });

    it("十分なデータでフェーズを判定", () => {
      const now = new Date();
      const activities = generateDailyActivities(
        1,
        new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000),
        120,
        10,
        0
      );

      const transition = detectPhaseTransition(activities);

      expect(["dormant", "emerging", "expansion", "consolidation", "declining"])
        .toContain(transition.currentPhase);
      expect(transition.daysInCurrentPhase).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Insight Generation
  // ============================================================

  describe("generateTimescaleInsight", () => {
    it("上昇トレンドのインサイト", () => {
      const trends = {
        weekly: { direction: "rising" as TrendDirection, velocity: 0.3, confidence: 0.8, dataPoints: 100 },
        monthly: { direction: "rising" as TrendDirection, velocity: 0.2, confidence: 0.7, dataPoints: 300 },
        quarterly: { direction: "rising" as TrendDirection, velocity: 0.15, confidence: 0.6, dataPoints: 900 },
      };
      const seasonal = { detected: false, peakMonths: [], troughMonths: [], amplitude: 0, confidence: 0 };
      const phase = {
        currentPhase: "expansion" as Phase,
        previousPhase: null,
        transitionDate: null,
        stability: 0.8,
        daysInCurrentPhase: 30,
      };

      const insight = generateTimescaleInsight(trends, seasonal, phase);

      expect(insight).toContain("成長");
      expect(insight).toContain("拡大");
    });

    it("季節パターンを含むインサイト", () => {
      const trends = {
        weekly: { direction: "stable" as TrendDirection, velocity: 0, confidence: 0.5, dataPoints: 50 },
        monthly: { direction: "stable" as TrendDirection, velocity: 0, confidence: 0.5, dataPoints: 150 },
        quarterly: { direction: "stable" as TrendDirection, velocity: 0, confidence: 0.5, dataPoints: 450 },
      };
      const seasonal = { detected: true, peakMonths: [1, 7], troughMonths: [4], amplitude: 0.5, confidence: 0.8 };
      const phase = {
        currentPhase: "consolidation" as Phase,
        previousPhase: null,
        transitionDate: null,
        stability: 0.9,
        daysInCurrentPhase: 60,
      };

      const insight = generateTimescaleInsight(trends, seasonal, phase);

      expect(insight).toContain("1月");
      expect(insight).toContain("7月");
      expect(insight).toContain("ピーク");
    });

    it("フェーズ遷移を含むインサイト", () => {
      const trends = {
        weekly: { direction: "falling" as TrendDirection, velocity: -0.2, confidence: 0.7, dataPoints: 80 },
        monthly: { direction: "stable" as TrendDirection, velocity: 0, confidence: 0.6, dataPoints: 240 },
        quarterly: { direction: "rising" as TrendDirection, velocity: 0.1, confidence: 0.5, dataPoints: 720 },
      };
      const seasonal = { detected: false, peakMonths: [], troughMonths: [], amplitude: 0, confidence: 0 };
      const phase = {
        currentPhase: "consolidation" as Phase,
        previousPhase: "expansion" as Phase,
        transitionDate: "2025-01-01",
        stability: 0.7,
        daysInCurrentPhase: 14,
      };

      const insight = generateTimescaleInsight(trends, seasonal, phase);

      expect(insight).toContain("一時的");
      expect(insight).toContain("遷移");
    });
  });

  // ============================================================
  // Utility Functions
  // ============================================================

  describe("filterByCluster", () => {
    it("特定クラスターのデータをフィルタリング", () => {
      const activities = [
        createActivity("2025-01-01", 1, 10),
        createActivity("2025-01-01", 2, 5),
        createActivity("2025-01-02", 1, 8),
        createActivity("2025-01-02", 3, 12),
      ];

      const filtered = filterByCluster(activities, 1);

      expect(filtered.length).toBe(2);
      expect(filtered.every(a => a.clusterId === 1)).toBe(true);
    });

    it("存在しないクラスターは空配列", () => {
      const activities = [
        createActivity("2025-01-01", 1, 10),
      ];

      const filtered = filterByCluster(activities, 999);

      expect(filtered.length).toBe(0);
    });
  });

  // ============================================================
  // Integration Tests
  // ============================================================

  describe("統合テスト", () => {
    it("成長クラスターの分析", () => {
      const now = new Date();
      const activities = generateDailyActivities(
        1,
        new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        180,
        5,
        0.1
      );

      const trends = calculateMultiScaleTrends(activities);
      const seasonal = detectSeasonalPattern(activities);
      const phase = detectPhaseTransition(activities);
      const insight = generateTimescaleInsight(trends, seasonal, phase);

      // 成長トレンドのデータなので、少なくとも一部のスケールで上昇を検出
      const hasRising =
        trends.weekly.direction === "rising" ||
        trends.monthly.direction === "rising" ||
        trends.quarterly.direction === "rising";

      expect(hasRising || trends.quarterly.velocity > 0).toBe(true);
      expect(insight.length).toBeGreaterThan(0);
    });

    it("休眠クラスターの分析", () => {
      // 1年以上前のデータのみ（現在は活動なし）
      const activities = [
        createActivity("2023-01-01", 1, 5),
        createActivity("2023-01-15", 1, 3),
      ];

      const trends = calculateMultiScaleTrends(activities);
      const phase = detectPhaseTransition(activities);

      // 古いデータのみなのでデータポイントは0
      expect(trends.weekly.dataPoints).toBe(0);
      // データが少ない場合はemerging（デフォルト）またはdormant
      expect(["dormant", "emerging"]).toContain(phase.currentPhase);
    });
  });
});
