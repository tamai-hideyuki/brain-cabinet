/**
 * Drift Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockBuildDriftTimeline,
  mockGetStateDescription,
  mockGetDailyDriftData,
  mockCalcGrowthAngle,
  mockCalcDriftForecast,
  mockDetectWarning,
  mockGenerateDriftInsight,
  mockDbAll,
} = vi.hoisted(() => ({
  mockBuildDriftTimeline: vi.fn(),
  mockGetStateDescription: vi.fn(),
  mockGetDailyDriftData: vi.fn(),
  mockCalcGrowthAngle: vi.fn(),
  mockCalcDriftForecast: vi.fn(),
  mockDetectWarning: vi.fn(),
  mockGenerateDriftInsight: vi.fn(),
  mockDbAll: vi.fn(),
}));

// モック
vi.mock("../../services/drift/driftService", () => ({
  buildDriftTimeline: mockBuildDriftTimeline,
  getStateDescription: mockGetStateDescription,
}));

vi.mock("../../services/drift/driftCore", () => ({
  getDailyDriftData: mockGetDailyDriftData,
  calcGrowthAngle: mockCalcGrowthAngle,
  calcDriftForecast: mockCalcDriftForecast,
  detectWarning: mockDetectWarning,
  generateDriftInsight: mockGenerateDriftInsight,
}));

vi.mock("../../db/client", () => ({
  db: {
    all: mockDbAll,
  },
}));

import { driftRoute } from "./index";

describe("driftRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /timeline", () => {
    it("タイムラインを返す", async () => {
      const mockTimeline = {
        range: "90d",
        days: [{ date: "2024-01-01", drift: 0.5, ema: 0.45 }],
        summary: {
          todayDrift: 0.5,
          todayEMA: 0.45,
          state: "normal",
          trend: "stable",
          mean: 0.4,
          stdDev: 0.1,
        },
      };
      mockBuildDriftTimeline.mockResolvedValue(mockTimeline);
      mockGetStateDescription.mockReturnValue("安定した成長を続けています");

      const res = await driftRoute.request("/timeline");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.days).toBeDefined();
      expect(json.summary).toBeDefined();
      expect(json.description).toBe("安定した成長を続けています");
    });

    it("rangeパラメータを処理する", async () => {
      mockBuildDriftTimeline.mockResolvedValue({
        range: "30d",
        days: [],
        summary: { state: "normal", trend: "stable" },
      });
      mockGetStateDescription.mockReturnValue("OK");

      await driftRoute.request("/timeline?range=30d");

      expect(mockBuildDriftTimeline).toHaveBeenCalledWith(30);
    });

    it("無効なrangeで400を返す", async () => {
      const res = await driftRoute.request("/timeline?range=500d");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Invalid range");
    });
  });

  describe("GET /events", () => {
    it("イベント一覧を返す", async () => {
      const now = Math.floor(Date.now() / 1000);
      mockDbAll.mockResolvedValue([
        {
          id: 1,
          detected_at: now,
          severity: "high",
          type: "overheat",
          message: "思考が過熱中",
          related_cluster: 1,
        },
      ]);

      const res = await driftRoute.request("/events");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.events).toHaveLength(1);
      expect(json.stats.high).toBe(1);
    });

    it("severityでフィルタリング", async () => {
      mockDbAll.mockResolvedValue([]);

      await driftRoute.request("/events?severity=high");

      expect(mockDbAll).toHaveBeenCalled();
    });

    it("無効なrangeで400を返す", async () => {
      const res = await driftRoute.request("/events?range=500d");
      const json = await res.json();

      expect(res.status).toBe(400);
    });
  });

  describe("GET /summary", () => {
    it("サマリーを返す", async () => {
      mockBuildDriftTimeline.mockResolvedValue({
        summary: {
          state: "normal",
          trend: "stable",
          todayEMA: 0.5,
          mean: 0.4,
        },
      });
      mockGetStateDescription.mockReturnValue("安定した成長");
      mockDbAll.mockResolvedValue([]);

      const res = await driftRoute.request("/summary");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.current).toBeDefined();
      expect(json.recentEvents).toBeDefined();
      expect(json.advice).toBeDefined();
    });
  });

  describe("GET /angle", () => {
    it("成長角度を返す", async () => {
      mockGetDailyDriftData.mockResolvedValue([
        { date: "2024-01-01", drift: 0.5, ema: 0.45 },
      ]);
      mockCalcGrowthAngle.mockReturnValue({
        trend: "rising",
        angleDegrees: 15,
        velocity: 0.1,
      });

      const res = await driftRoute.request("/angle");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.trend).toBe("rising");
      expect(json.angleDegrees).toBe(15);
      expect(json.description).toBeDefined();
    });
  });

  describe("GET /forecast", () => {
    it("予測を返す", async () => {
      mockGetDailyDriftData.mockResolvedValue([]);
      mockCalcGrowthAngle.mockReturnValue({ trend: "stable" });
      mockCalcDriftForecast.mockReturnValue({
        forecast3d: 0.5,
        forecast7d: 0.55,
        confidence: "high",
      });

      const res = await driftRoute.request("/forecast");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.forecast3d).toBe(0.5);
      expect(json.forecast7d).toBe(0.55);
      expect(json.interpretation).toBeDefined();
    });
  });

  describe("GET /warning", () => {
    it("警告情報を返す", async () => {
      mockGetDailyDriftData.mockResolvedValue([]);
      mockDetectWarning.mockReturnValue({
        hasWarning: false,
        type: null,
        message: null,
      });

      const res = await driftRoute.request("/warning");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.hasWarning).toBe(false);
    });
  });

  describe("GET /insight", () => {
    it("統合インサイトを返す", async () => {
      mockGenerateDriftInsight.mockResolvedValue({
        mode: "exploration",
        angle: { trend: "rising" },
        forecast: { forecast3d: 0.5 },
        warning: { hasWarning: false },
        advice: "良い調子です",
      });

      const res = await driftRoute.request("/insight");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe("exploration");
      expect(json.advice).toBeDefined();
    });
  });
});
