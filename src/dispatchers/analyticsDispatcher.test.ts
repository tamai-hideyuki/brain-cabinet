/**
 * Analytics Dispatcher のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../services/analytics", () => ({
  getSummaryStats: vi.fn(),
  parseDateRange: vi.fn(),
  getSemanticDiffTimeline: vi.fn(),
  getClusterJourney: vi.fn(),
  getDailyActivity: vi.fn(),
  getTrendStats: vi.fn(),
}));

import { analyticsDispatcher } from "./analyticsDispatcher";
import * as analyticsService from "../services/analytics";

describe("analyticsDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("summary", () => {
    it("getSummaryStats を呼び出す", async () => {
      const mockResult = {
        totalNotes: 100,
        byType: { scratch: 50, learning: 30, decision: 20 },
      };
      vi.mocked(analyticsService.getSummaryStats).mockResolvedValue(mockResult);

      const result = await analyticsDispatcher.summary();

      expect(analyticsService.getSummaryStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe("timeline", () => {
    it("デフォルトで30dの範囲を使用する", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = [{ date: "2024-01-01", diff: 0.5 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockResult);

      await analyticsDispatcher.timeline(undefined);

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(analyticsService.getSemanticDiffTimeline).toHaveBeenCalledWith(mockDateRange);
    });

    it("指定されたrangeを使用する", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = [{ date: "2024-01-01", diff: 0.5 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockResult);

      await analyticsDispatcher.timeline({ range: "7d" });

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("7d");
    });

    it("結果を返す", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = [
        { date: "2024-01-01", diff: 0.5 },
        { date: "2024-01-02", diff: 0.6 },
      ];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockResult);

      const result = await analyticsDispatcher.timeline(undefined);

      expect(result).toEqual(mockResult);
    });
  });

  describe("journey", () => {
    it("デフォルトで30dの範囲を使用する", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = { clusters: [], transitions: [] };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getClusterJourney).mockResolvedValue(mockResult);

      await analyticsDispatcher.journey(undefined);

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(analyticsService.getClusterJourney).toHaveBeenCalledWith(mockDateRange);
    });

    it("指定されたrangeを使用する", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = { clusters: [], transitions: [] };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getClusterJourney).mockResolvedValue(mockResult);

      await analyticsDispatcher.journey({ range: "90d" });

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("90d");
    });
  });

  describe("heatmap", () => {
    it("デフォルトで現在の年を使用する", async () => {
      const currentYear = new Date().getFullYear();
      const mockResult = { year: currentYear, data: [] };
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockResult);

      await analyticsDispatcher.heatmap(undefined);

      expect(analyticsService.getDailyActivity).toHaveBeenCalledWith(currentYear);
    });

    it("指定された年を使用する", async () => {
      const mockResult = { year: 2023, data: [] };
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockResult);

      await analyticsDispatcher.heatmap({ year: 2023 });

      expect(analyticsService.getDailyActivity).toHaveBeenCalledWith(2023);
    });

    it("結果を返す", async () => {
      const mockResult = {
        year: 2024,
        data: [{ date: "2024-01-01", count: 5, level: 2 }],
      };
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockResult);

      const result = await analyticsDispatcher.heatmap({ year: 2024 });

      expect(result).toEqual(mockResult);
    });
  });

  describe("trends", () => {
    it("デフォルトでday単位と30d範囲を使用する", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = { unit: "day" as const, data: [] };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockResult);

      await analyticsDispatcher.trends(undefined);

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("day", mockDateRange);
    });

    it("指定された単位と範囲を使用する", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = { unit: "week" as const, data: [] };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockResult);

      await analyticsDispatcher.trends({ unit: "week", range: "90d" });

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("90d");
      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("week", mockDateRange);
    });

    it("month単位で呼び出せる", async () => {
      const mockDateRange = { start: new Date(), end: new Date() };
      const mockResult = { unit: "month" as const, data: [] };
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockResult);

      await analyticsDispatcher.trends({ unit: "month" });

      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("month", mockDateRange);
    });
  });
});
