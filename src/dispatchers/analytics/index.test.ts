/**
 * Analytics Dispatcher のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/analytics", () => ({
  getSummaryStats: vi.fn(),
  parseDateRange: vi.fn(),
  getSemanticDiffTimeline: vi.fn(),
  getClusterJourney: vi.fn(),
  getDailyActivity: vi.fn(),
  getTrendStats: vi.fn(),
}));

import { analyticsDispatcher } from "./index";
import * as analyticsService from "../../services/analytics";

describe("analyticsDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("summary", () => {
    it("getSummaryStats を呼び出す", async () => {
      const mockResult = {
        totalNotes: 100,
        notesLast30Days: 25,
        changesLast30Days: 50,
        avgSemanticDiffLast30Days: 0.15,
      };
      vi.mocked(analyticsService.getSummaryStats).mockResolvedValue(mockResult);

      const result = await analyticsDispatcher.summary();

      expect(analyticsService.getSummaryStats).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(mockResult);
    });
  });

  describe("timeline", () => {
    it("デフォルトで30dの範囲を使用する", async () => {
      const mockDateRange = { start: 1704067200, end: 1706745600 };
      const mockResult = [{ date: "2024-01-01", totalSemanticDiff: 0.5, changeCount: 3 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockResult);

      await analyticsDispatcher.timeline(undefined);

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(analyticsService.getSemanticDiffTimeline).toHaveBeenCalledWith(mockDateRange);
    });

    it("指定されたrangeを使用する", async () => {
      const mockDateRange = { start: 1704067200, end: 1704672000 };
      const mockResult = [{ date: "2024-01-01", totalSemanticDiff: 0.5, changeCount: 3 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockResult);

      await analyticsDispatcher.timeline({ range: "7d" });

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("7d");
    });

    it("結果を返す", async () => {
      const mockDateRange = { start: 1704067200, end: 1706745600 };
      const mockResult = [
        { date: "2024-01-01", totalSemanticDiff: 0.5, changeCount: 3 },
        { date: "2024-01-02", totalSemanticDiff: 0.6, changeCount: 2 },
      ];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getSemanticDiffTimeline).mockResolvedValue(mockResult);

      const result = await analyticsDispatcher.timeline(undefined);

      expect(result).toStrictEqual(mockResult);
    });
  });

  describe("journey", () => {
    it("デフォルトで30dの範囲を使用する", async () => {
      const mockDateRange = { start: 1704067200, end: 1706745600 };
      const mockResult = [
        { date: "2024-01-01", clusterId: 1, noteId: "note-1", title: "Note 1" },
      ];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getClusterJourney).mockResolvedValue(mockResult);

      await analyticsDispatcher.journey(undefined);

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(analyticsService.getClusterJourney).toHaveBeenCalledWith(mockDateRange);
    });

    it("指定されたrangeを使用する", async () => {
      const mockDateRange = { start: 1704067200, end: 1711929600 };
      const mockResult = [
        { date: "2024-01-01", clusterId: 1, noteId: "note-1", title: "Note 1" },
      ];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getClusterJourney).mockResolvedValue(mockResult);

      await analyticsDispatcher.journey({ range: "90d" });

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("90d");
    });
  });

  describe("heatmap", () => {
    it("デフォルトで現在の年を使用する", async () => {
      const currentYear = new Date().getFullYear();
      const mockResult = [{ date: `${currentYear}-01-01`, count: 3, level: 2 }];
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockResult);

      await analyticsDispatcher.heatmap(undefined);

      expect(analyticsService.getDailyActivity).toHaveBeenCalledWith(currentYear);
    });

    it("指定された年を使用する", async () => {
      const mockResult = [{ date: "2023-01-01", count: 3, level: 2 }];
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockResult);

      await analyticsDispatcher.heatmap({ year: 2023 });

      expect(analyticsService.getDailyActivity).toHaveBeenCalledWith(2023);
    });

    it("結果を返す", async () => {
      const mockResult = [
        { date: "2024-01-01", count: 5, level: 2 },
        { date: "2024-01-02", count: 0, level: 0 },
      ];
      vi.mocked(analyticsService.getDailyActivity).mockResolvedValue(mockResult);

      const result = await analyticsDispatcher.heatmap({ year: 2024 });

      expect(result).toStrictEqual(mockResult);
    });
  });

  describe("trends", () => {
    it("デフォルトでday単位と30d範囲を使用する", async () => {
      const mockDateRange = { start: 1704067200, end: 1706745600 };
      const mockResult = [{ period: "2024-W01", clusterId: 1, count: 5 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockResult);

      await analyticsDispatcher.trends(undefined);

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("30d");
      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("day", mockDateRange);
    });

    it("指定された単位と範囲を使用する", async () => {
      const mockDateRange = { start: 1704067200, end: 1711929600 };
      const mockResult = [{ period: "2024-W01", clusterId: 1, count: 5 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockResult);

      await analyticsDispatcher.trends({ unit: "week", range: "90d" });

      expect(analyticsService.parseDateRange).toHaveBeenCalledWith("90d");
      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("week", mockDateRange);
    });

    it("month単位で呼び出せる", async () => {
      const mockDateRange = { start: 1704067200, end: 1706745600 };
      const mockResult = [{ period: "2024-01", clusterId: 1, count: 5 }];
      vi.mocked(analyticsService.parseDateRange).mockReturnValue(mockDateRange);
      vi.mocked(analyticsService.getTrendStats).mockResolvedValue(mockResult);

      await analyticsDispatcher.trends({ unit: "month" });

      expect(analyticsService.getTrendStats).toHaveBeenCalledWith("month", mockDateRange);
    });
  });
});
