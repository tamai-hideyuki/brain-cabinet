/**
 * Analytics Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/analytics", () => ({
  parseDateRange: vi.fn(),
  getSummaryStats: vi.fn(),
  getSemanticDiffTimeline: vi.fn(),
  getClusterJourney: vi.fn(),
  getDailyActivity: vi.fn(),
  getTrendStats: vi.fn(),
}));

import { analyticsRoute } from "./index";
import * as analyticsService from "../../services/analytics";

describe("analyticsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /summary", () => {
    it("サマリー統計を返す", async () => {
      const mockStats = {
        totalNotes: 100,
        byType: { scratch: 50, learning: 30, decision: 20 },
      };
      vi.mocked(analyticsService.getSummaryStats).mockResolvedValue(mockStats as any);

      const res = await analyticsRoute.request("/summary");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockStats);
    });
  });

  describe("GET /timeline", () => {
    it("デフォルトで30dの範囲を使用する", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      const mockTimeline = [{ date: "2024-01-01", avgDiff: 0.5 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockTimeline as any);

      const res = await analyticsRoute.request("/timeline");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(json.range).toBe("30d");
      expect(json.data).toEqual(mockTimeline);
    });

    it("指定されたrangeを使用する", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      const mockTimeline: any[] = [];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockTimeline);

      const res = await analyticsRoute.request("/timeline?range=7d");

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("7d");
    });

    it("startDateとendDateを含む", async () => {
      const mockDateRange = { start: 1704067200, end: 1706745600 }; // 2024-01-01 to 2024-02-01
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue([]);

      const res = await analyticsRoute.request("/timeline");
      const json = await res.json();

      expect(json).toHaveProperty("startDate");
      expect(json).toHaveProperty("endDate");
    });
  });

  describe("GET /journey", () => {
    it("デフォルトで90dの範囲を使用する", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getClusterJourney).mockResolvedValue([]);

      const res = await analyticsRoute.request("/journey");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("90d");
      expect(json.range).toBe("90d");
    });

    it("クラスタごとにグループ化する", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      const mockJourney = [
        { noteId: "1", title: "Note 1", clusterId: 1, date: "2024-01-01" },
        { noteId: "2", title: "Note 2", clusterId: 1, date: "2024-01-02" },
        { noteId: "3", title: "Note 3", clusterId: 2, date: "2024-01-01" },
      ];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getClusterJourney).mockResolvedValue(mockJourney as any);

      const res = await analyticsRoute.request("/journey");
      const json = await res.json();

      expect(json.totalNotes).toBe(3);
      expect(json.byCluster).toHaveLength(2);

      const cluster1 = json.byCluster.find((c: any) => c.clusterId === 1);
      expect(cluster1.noteCount).toBe(2);
    });
  });

  describe("GET /heatmap", () => {
    it("デフォルトで現在の年を使用する", async () => {
      const currentYear = new Date().getFullYear();
      const mockHeatmap = [{ date: `${currentYear}-01-01`, count: 5, level: 2 }];
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockHeatmap as any);

      const res = await analyticsRoute.request("/heatmap");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(analyticsService.getDailyActivity).toHaveBeenCalledWith(currentYear);
      expect(json.year).toBe(currentYear);
    });

    it("指定された年を使用する", async () => {
      const mockHeatmap = [{ date: "2023-01-01", count: 3, level: 1 }];
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockHeatmap as any);

      const res = await analyticsRoute.request("/heatmap?year=2023");
      const json = await res.json();

      expect(analyticsService.getDailyActivity).toHaveBeenCalledWith(2023);
      expect(json.year).toBe(2023);
    });

    it("不正な年の場合400エラーを返す", async () => {
      const res = await analyticsRoute.request("/heatmap?year=invalid");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid year");
    });

    it("年が範囲外の場合400エラーを返す（1999）", async () => {
      const res = await analyticsRoute.request("/heatmap?year=1999");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid year");
    });

    it("年が範囲外の場合400エラーを返す（2101）", async () => {
      const res = await analyticsRoute.request("/heatmap?year=2101");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid year");
    });

    it("統計情報を計算する", async () => {
      const mockHeatmap = [
        { date: "2024-01-01", count: 5, level: 2 },
        { date: "2024-01-02", count: 0, level: 0 },
        { date: "2024-01-03", count: 10, level: 4 },
      ];
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockHeatmap as any);

      const res = await analyticsRoute.request("/heatmap?year=2024");
      const json = await res.json();

      expect(json.totalActivity).toBe(15);
      expect(json.activeDays).toBe(2);
      expect(json.maxDailyCount).toBe(10);
    });

    it("週ごとにグループ化する", async () => {
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue([]);

      const res = await analyticsRoute.request("/heatmap?year=2024");
      const json = await res.json();

      expect(json).toHaveProperty("weeks");
      expect(json).toHaveProperty("days");
    });
  });

  describe("GET /trends", () => {
    it("デフォルトでmonth単位と6mの範囲を使用する", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      const mockTrends: any[] = [];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockTrends);

      const res = await analyticsRoute.request("/trends");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("6m");
      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("month", mockDateRange);
      expect(json.unit).toBe("month");
      expect(json.range).toBe("6m");
    });

    it("week単位を指定できる", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue([]);

      const res = await analyticsRoute.request("/trends?unit=week");

      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("week", mockDateRange);
    });

    it("期間ごとにまとめる", async () => {
      const mockDateRange = { start: 1000000, end: 2000000 };
      const mockTrends = [
        { period: "2024-01", clusterId: 1, count: 5 },
        { period: "2024-01", clusterId: 2, count: 3 },
        { period: "2024-02", clusterId: 1, count: 7 },
      ];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockTrends as any);

      const res = await analyticsRoute.request("/trends");
      const json = await res.json();

      expect(json.periods).toHaveLength(2);
      expect(json.periods[0].period).toBe("2024-01");
      expect(json.periods[0].totalNotes).toBe(8);
    });
  });
});
