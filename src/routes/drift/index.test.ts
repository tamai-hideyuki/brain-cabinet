/**
 * Drift Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockBuildDriftTimeline,
  mockGetStateDescription,
  mockGetDailyPhases,
  mockGetDailyDriftData,
  mockCalcGrowthAngle,
  mockCalcDriftForecast,
  mockDetectWarning,
  mockDetectExtendedWarning,
  mockGenerateDriftInsight,
  mockDbAll,
} = vi.hoisted(() => ({
  mockBuildDriftTimeline: vi.fn(),
  mockGetStateDescription: vi.fn(),
  mockGetDailyPhases: vi.fn(),
  mockGetDailyDriftData: vi.fn(),
  mockCalcGrowthAngle: vi.fn(),
  mockCalcDriftForecast: vi.fn(),
  mockDetectWarning: vi.fn(),
  mockDetectExtendedWarning: vi.fn(),
  mockGenerateDriftInsight: vi.fn(),
  mockDbAll: vi.fn(),
}));

// モック
vi.mock("../../services/drift/driftService", () => ({
  buildDriftTimeline: mockBuildDriftTimeline,
  getStateDescription: mockGetStateDescription,
  getDailyPhases: mockGetDailyPhases,
}));

vi.mock("../../services/drift/driftCore", () => ({
  getDailyDriftData: mockGetDailyDriftData,
  calcGrowthAngle: mockCalcGrowthAngle,
  calcDriftForecast: mockCalcDriftForecast,
  detectWarning: mockDetectWarning,
  detectExtendedWarning: mockDetectExtendedWarning,
  generateDriftInsight: mockGenerateDriftInsight,
}));

vi.mock("../../db/client", () => ({
  db: {
    all: mockDbAll,
  },
}));

// v7.3 アノテーション関連のモック
const {
  mockUpsertAnnotation,
  mockGetAnnotationByDate,
  mockGetRecentAnnotations,
  mockDeleteAnnotationByDate,
  mockGetAnnotationStats,
  mockIsValidLabel,
} = vi.hoisted(() => ({
  mockUpsertAnnotation: vi.fn(),
  mockGetAnnotationByDate: vi.fn(),
  mockGetRecentAnnotations: vi.fn(),
  mockDeleteAnnotationByDate: vi.fn(),
  mockGetAnnotationStats: vi.fn(),
  mockIsValidLabel: vi.fn(),
}));

vi.mock("../../services/drift/driftAnnotation", () => ({
  upsertAnnotation: mockUpsertAnnotation,
  getAnnotationByDate: mockGetAnnotationByDate,
  getRecentAnnotations: mockGetRecentAnnotations,
  deleteAnnotation: vi.fn(),
  deleteAnnotationByDate: mockDeleteAnnotationByDate,
  getAnnotationStats: mockGetAnnotationStats,
  isValidLabel: mockIsValidLabel,
}));

import { driftRoute } from "./index";

describe("driftRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトでisValidLabelはtrueを返す
    mockIsValidLabel.mockReturnValue(true);
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

      expect(mockBuildDriftTimeline).toHaveBeenCalledWith(30, false);
    });

    it("無効なrangeで400を返す", async () => {
      const res = await driftRoute.request("/timeline?range=500d");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Invalid range");
    });

    it("annotationsパラメータを処理する", async () => {
      mockBuildDriftTimeline.mockResolvedValue({
        range: "90d",
        days: [{ date: "2024-01-01", drift: 0.5, ema: 0.45, phase: "creation" }],
        summary: { state: "normal", trend: "stable" },
      });
      mockGetStateDescription.mockReturnValue("OK");

      await driftRoute.request("/timeline?annotations=true");

      expect(mockBuildDriftTimeline).toHaveBeenCalledWith(90, true);
    });

    it("phaseフィールドを含む", async () => {
      mockBuildDriftTimeline.mockResolvedValue({
        range: "90d",
        days: [
          { date: "2024-01-01", drift: 0.5, ema: 0.45, phase: "creation" },
          { date: "2024-01-02", drift: 0.3, ema: 0.40, phase: "neutral" },
        ],
        summary: { state: "normal", trend: "stable" },
      });
      mockGetStateDescription.mockReturnValue("OK");

      const res = await driftRoute.request("/timeline");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.days[0].phase).toBe("creation");
      expect(json.days[1].phase).toBe("neutral");
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
      mockGetDailyDriftData.mockResolvedValue([
        { date: "2024-01-15", drift: 0.5, ema: 0.45 },
      ]);
      mockDetectWarning.mockReturnValue({
        state: "stable",
        severity: "none",
        recommendation: "安定した成長リズムです。",
      });
      mockGetDailyPhases.mockResolvedValue(new Map([["2024-01-15", "neutral"]]));
      mockDetectExtendedWarning.mockReturnValue({
        baseState: "stable",
        extendedType: "stable",
        phase: "neutral",
        severity: "none",
        isCreativeOverheat: false,
        recommendation: "安定した成長リズムです。",
        insight: "安定した成長リズムを維持しています。",
      });

      const res = await driftRoute.request("/warning");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.state).toBe("stable");
      expect(json.extendedWarning).toBeDefined();
      expect(json.extendedWarning.isCreativeOverheat).toBe(false);
    });

    it("creative overheatを検出する (v7.4)", async () => {
      mockGetDailyDriftData.mockResolvedValue([
        { date: "2024-01-15", drift: 2.5, ema: 2.3 },
      ]);
      mockDetectWarning.mockReturnValue({
        state: "overheat",
        severity: "mid",
        recommendation: "知的活動が過剰です。",
      });
      mockGetDailyPhases.mockResolvedValue(new Map([["2024-01-15", "creation"]]));
      mockDetectExtendedWarning.mockReturnValue({
        baseState: "overheat",
        extendedType: "creative_overheat",
        phase: "creation",
        severity: "mid",
        isCreativeOverheat: true,
        recommendation: "創造的な活動が活発です！",
        insight: "新しいアイデアや発見が多い「創造的過熱」状態です。",
      });

      const res = await driftRoute.request("/warning");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.state).toBe("overheat");
      expect(json.extendedWarning.isCreativeOverheat).toBe(true);
      expect(json.extendedWarning.extendedType).toBe("creative_overheat");
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

  // ============================================================
  // v7.3 アノテーション API のテスト
  // ============================================================

  describe("GET /annotation/labels", () => {
    it("ラベル一覧を返す", async () => {
      const res = await driftRoute.request("/annotation/labels");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.labels).toBeDefined();
      expect(json.labels).toHaveLength(6);
      expect(json.labels[0]).toHaveProperty("value");
      expect(json.labels[0]).toHaveProperty("description");
    });
  });

  describe("GET /annotation/:date", () => {
    it("アノテーションを返す", async () => {
      mockGetAnnotationByDate.mockResolvedValue({
        id: 1,
        date: "2024-01-15",
        label: "breakthrough",
        note: "良い発見があった",
        autoPhase: "creation",
        createdAt: 1705312800,
        updatedAt: 1705312800,
      });

      const res = await driftRoute.request("/annotation/2024-01-15");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.annotation).toBeDefined();
      expect(json.annotation.label).toBe("breakthrough");
    });

    it("存在しない場合はnullを返す", async () => {
      mockGetAnnotationByDate.mockResolvedValue(null);

      const res = await driftRoute.request("/annotation/2024-01-15");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.annotation).toBeNull();
    });
  });

  describe("GET /annotations", () => {
    it("アノテーション一覧を返す", async () => {
      mockGetRecentAnnotations.mockResolvedValue([
        { id: 1, date: "2024-01-15", label: "breakthrough", note: null },
        { id: 2, date: "2024-01-14", label: "routine", note: null },
      ]);

      const res = await driftRoute.request("/annotations");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.annotations).toHaveLength(2);
      expect(json.count).toBe(2);
    });

    it("daysパラメータを処理する", async () => {
      mockGetRecentAnnotations.mockResolvedValue([]);

      await driftRoute.request("/annotations?days=60");

      expect(mockGetRecentAnnotations).toHaveBeenCalledWith(60);
    });

    it("無効なdaysで400を返す", async () => {
      const res = await driftRoute.request("/annotations?days=500");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Invalid days");
    });
  });

  describe("POST /annotation", () => {
    it("アノテーションを作成する", async () => {
      mockUpsertAnnotation.mockResolvedValue({
        id: 1,
        date: "2024-01-15",
        label: "breakthrough",
        note: "素晴らしい発見",
        autoPhase: "creation",
        createdAt: 1705312800,
        updatedAt: 1705312800,
      });

      const res = await driftRoute.request("/annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2024-01-15",
          label: "breakthrough",
          note: "素晴らしい発見",
          autoPhase: "creation",
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.annotation.label).toBe("breakthrough");
    });

    it("dateが必須", async () => {
      const res = await driftRoute.request("/annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "breakthrough" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("date and label are required");
    });

    it("labelが必須", async () => {
      const res = await driftRoute.request("/annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2024-01-15" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("date and label are required");
    });

    it("無効なlabelで400を返す", async () => {
      mockIsValidLabel.mockReturnValue(false);

      const res = await driftRoute.request("/annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2024-01-15", label: "invalid" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Invalid label");
    });
  });

  describe("DELETE /annotation/:date", () => {
    it("アノテーションを削除する", async () => {
      mockDeleteAnnotationByDate.mockResolvedValue(true);

      const res = await driftRoute.request("/annotation/2024-01-15", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.date).toBe("2024-01-15");
    });

    it("存在しない場合は404を返す", async () => {
      mockDeleteAnnotationByDate.mockResolvedValue(false);

      const res = await driftRoute.request("/annotation/2024-01-15", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toContain("not found");
    });
  });

  describe("GET /annotation/stats", () => {
    it("統計を返す", async () => {
      mockGetAnnotationStats.mockResolvedValue({
        total: 30,
        byLabel: {
          breakthrough: 5,
          exploration: 8,
          deepening: 6,
          confusion: 3,
          rest: 4,
          routine: 4,
        },
        phaseMatch: { matched: 20, mismatched: 5, unknown: 5 },
      });

      const res = await driftRoute.request("/annotation/stats");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.total).toBe(30);
      expect(json.byLabel).toBeDefined();
      expect(json.phaseMatch.matched).toBe(20);
    });

    it("daysパラメータを処理する", async () => {
      mockGetAnnotationStats.mockResolvedValue({
        total: 0,
        byLabel: {},
        phaseMatch: { matched: 0, mismatched: 0, unknown: 0 },
      });

      await driftRoute.request("/annotation/stats?days=60");

      expect(mockGetAnnotationStats).toHaveBeenCalledWith(60);
    });

    it("無効なdaysで400を返す", async () => {
      const res = await driftRoute.request("/annotation/stats?days=500");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("Invalid days");
    });
  });
});
