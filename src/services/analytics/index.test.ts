/**
 * Analytics Service のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseDateRange,
  timestampToDate,
  timestampToMonth,
  timestampToWeek,
  calculateHeatmapLevel,
  getSemanticDiffTimeline,
  getClusterJourney,
  getDailyActivity,
  getTrendStats,
  getSummaryStats,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
      orderBy: vi.fn().mockResolvedValue([]),
    }),
  });
  return {
    db: {
      select: mockSelect,
    },
  };
});

import { db } from "../../db/client";

describe("analyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // parseDateRange のテスト
  // ============================================
  describe("parseDateRange", () => {
    it("日指定 (30d) をパースする", () => {
      const result = parseDateRange("30d");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 30 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });

    it("週指定 (2w) をパースする", () => {
      const result = parseDateRange("2w");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 2 * 7 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });

    it("月指定 (3m) をパースする", () => {
      const result = parseDateRange("3m");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 3 * 30 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });

    it("不正な形式はデフォルト30日を返す", () => {
      const result = parseDateRange("invalid");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 30 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });

    it("空文字はデフォルト30日を返す", () => {
      const result = parseDateRange("");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 30 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });

    it("90d をパースする", () => {
      const result = parseDateRange("90d");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 90 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });

    it("6m をパースする", () => {
      const result = parseDateRange("6m");
      const now = Math.floor(Date.now() / 1000);
      const expectedStart = now - 6 * 30 * 24 * 60 * 60;

      expect(result.end).toBeCloseTo(now, -1);
      expect(result.start).toBeCloseTo(expectedStart, -1);
    });
  });

  // ============================================
  // timestampToDate のテスト
  // ============================================
  describe("timestampToDate", () => {
    it("Unix timestamp を YYYY-MM-DD 形式に変換する", () => {
      // 2024-01-15 00:00:00 UTC
      const timestamp = 1705276800;
      const result = timestampToDate(timestamp);
      expect(result).toBe("2024-01-15");
    });

    it("2023-06-20 を正しく変換する", () => {
      // 2023-06-20 12:00:00 UTC
      const timestamp = 1687262400;
      const result = timestampToDate(timestamp);
      expect(result).toBe("2023-06-20");
    });

    it("2025-12-31 を正しく変換する", () => {
      // 2025-12-31 00:00:00 UTC
      const timestamp = 1767139200;
      const result = timestampToDate(timestamp);
      expect(result).toBe("2025-12-31");
    });
  });

  // ============================================
  // timestampToMonth のテスト
  // ============================================
  describe("timestampToMonth", () => {
    it("Unix timestamp を YYYY-MM 形式に変換する", () => {
      // 2024-01-15 00:00:00 UTC
      const timestamp = 1705276800;
      const result = timestampToMonth(timestamp);
      expect(result).toBe("2024-01");
    });

    it("2023-06-20 を 2023-06 に変換する", () => {
      const timestamp = 1687262400;
      const result = timestampToMonth(timestamp);
      expect(result).toBe("2023-06");
    });

    it("月が1桁の場合は0埋めする", () => {
      // 2024-03-01 00:00:00 UTC
      const timestamp = 1709251200;
      const result = timestampToMonth(timestamp);
      expect(result).toBe("2024-03");
    });

    it("12月を正しく変換する", () => {
      // 2024-12-15 00:00:00 UTC
      const timestamp = 1734220800;
      const result = timestampToMonth(timestamp);
      expect(result).toBe("2024-12");
    });
  });

  // ============================================
  // timestampToWeek のテスト
  // ============================================
  describe("timestampToWeek", () => {
    it("Unix timestamp を YYYY-Www 形式に変換する", () => {
      // 2024-01-15 00:00:00 UTC (Week 3)
      const timestamp = 1705276800;
      const result = timestampToWeek(timestamp);
      expect(result).toMatch(/^2024-W\d{2}$/);
    });

    it("年始を正しく変換する", () => {
      // 2024-01-01 00:00:00 UTC
      const timestamp = 1704067200;
      const result = timestampToWeek(timestamp);
      expect(result).toMatch(/^2024-W01$/);
    });

    it("週番号が2桁になる場合も正しく変換する", () => {
      // 2024-03-15 00:00:00 UTC (Week 11)
      const timestamp = 1710460800;
      const result = timestampToWeek(timestamp);
      expect(result).toMatch(/^2024-W\d{2}$/);
    });
  });

  // ============================================
  // calculateHeatmapLevel のテスト
  // ============================================
  describe("calculateHeatmapLevel", () => {
    it("count が 0 のときは level 0 を返す", () => {
      expect(calculateHeatmapLevel(0, 10)).toBe(0);
    });

    it("maxCount が 0 のときは level 0 を返す", () => {
      expect(calculateHeatmapLevel(5, 0)).toBe(0);
    });

    it("比率が 0.25 以下のときは level 1 を返す", () => {
      expect(calculateHeatmapLevel(2, 10)).toBe(1);
      expect(calculateHeatmapLevel(1, 10)).toBe(1);
    });

    it("比率が 0.25-0.5 のときは level 2 を返す", () => {
      expect(calculateHeatmapLevel(3, 10)).toBe(2);
      expect(calculateHeatmapLevel(4, 10)).toBe(2);
      expect(calculateHeatmapLevel(5, 10)).toBe(2);
    });

    it("比率が 0.5-0.75 のときは level 3 を返す", () => {
      expect(calculateHeatmapLevel(6, 10)).toBe(3);
      expect(calculateHeatmapLevel(7, 10)).toBe(3);
    });

    it("比率が 0.75 より大きいときは level 4 を返す", () => {
      expect(calculateHeatmapLevel(8, 10)).toBe(4);
      expect(calculateHeatmapLevel(9, 10)).toBe(4);
      expect(calculateHeatmapLevel(10, 10)).toBe(4);
    });

    it("count と maxCount が等しいときは level 4 を返す", () => {
      expect(calculateHeatmapLevel(5, 5)).toBe(4);
    });

    it("境界値をテストする", () => {
      // 25% ちょうど -> level 1
      expect(calculateHeatmapLevel(25, 100)).toBe(1);
      // 50% ちょうど -> level 2
      expect(calculateHeatmapLevel(50, 100)).toBe(2);
      // 75% ちょうど -> level 3
      expect(calculateHeatmapLevel(75, 100)).toBe(3);
    });
  });

  // ============================================
  // getSemanticDiffTimeline のテスト
  // ============================================
  describe("getSemanticDiffTimeline", () => {
    it("空の結果を返す場合", async () => {
      // 2つのクエリをモック: noteHistory と notes
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhereWithOrderBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhereWithoutOrderBy = vi.fn().mockResolvedValue([]);
      const mockFromHistory = vi.fn().mockReturnValue({ where: mockWhereWithOrderBy });
      const mockFromNotes = vi.fn().mockReturnValue({ where: mockWhereWithoutOrderBy });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: mockFromHistory } as any)  // noteHistory
        .mockReturnValueOnce({ from: mockFromNotes } as any);   // notes

      const result = await getSemanticDiffTimeline({ start: 0, end: 100 });
      expect(result).toEqual([]);
    });

    it("日付ごとに集計する", async () => {
      const mockHistoryData = [
        { createdAt: 1705276800, semanticDiff: "0.5" },
        { createdAt: 1705276900, semanticDiff: "0.3" },
        { createdAt: 1705363200, semanticDiff: "0.2" },
      ];
      const mockNotesData = [
        { createdAt: 1705276800, updatedAt: 1705276800 },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockHistoryData);
      const mockWhereWithOrderBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhereWithoutOrderBy = vi.fn().mockResolvedValue(mockNotesData);
      const mockFromHistory = vi.fn().mockReturnValue({ where: mockWhereWithOrderBy });
      const mockFromNotes = vi.fn().mockReturnValue({ where: mockWhereWithoutOrderBy });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: mockFromHistory } as any)
        .mockReturnValueOnce({ from: mockFromNotes } as any);

      const result = await getSemanticDiffTimeline({ start: 0, end: Date.now() / 1000 });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("date");
      expect(result[0]).toHaveProperty("totalSemanticDiff");
      expect(result[0]).toHaveProperty("changeCount");
    });

    it("semanticDiff が null の場合は 0 として扱う", async () => {
      const mockHistoryData = [{ createdAt: 1705276800, semanticDiff: null }];
      const mockNotesData: { createdAt: number; updatedAt: number }[] = [];

      const mockOrderBy = vi.fn().mockResolvedValue(mockHistoryData);
      const mockWhereWithOrderBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhereWithoutOrderBy = vi.fn().mockResolvedValue(mockNotesData);
      const mockFromHistory = vi.fn().mockReturnValue({ where: mockWhereWithOrderBy });
      const mockFromNotes = vi.fn().mockReturnValue({ where: mockWhereWithoutOrderBy });

      vi.mocked(db.select)
        .mockReturnValueOnce({ from: mockFromHistory } as any)
        .mockReturnValueOnce({ from: mockFromNotes } as any);

      const result = await getSemanticDiffTimeline({ start: 0, end: Date.now() / 1000 });

      expect(result.length).toBe(1);
      expect(result[0].totalSemanticDiff).toBe(0);
    });
  });

  // ============================================
  // getClusterJourney のテスト
  // ============================================
  describe("getClusterJourney", () => {
    it("空の結果を返す場合", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getClusterJourney({ start: 0, end: 100 });
      expect(result).toEqual([]);
    });

    it("ノートのクラスタ遷移を返す", async () => {
      const mockData = [
        { id: "note-1", title: "Note 1", clusterId: 1, createdAt: 1705276800 },
        { id: "note-2", title: "Note 2", clusterId: 2, createdAt: 1705363200 },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockData);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getClusterJourney({ start: 0, end: Date.now() / 1000 });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: "2024-01-15",
        clusterId: 1,
        noteId: "note-1",
        title: "Note 1",
      });
    });

    it("clusterId が null のノートも含む", async () => {
      const mockData = [
        { id: "note-1", title: "Note 1", clusterId: null, createdAt: 1705276800 },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockData);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getClusterJourney({ start: 0, end: Date.now() / 1000 });

      expect(result[0].clusterId).toBeNull();
    });
  });

  // ============================================
  // getDailyActivity のテスト
  // ============================================
  describe("getDailyActivity", () => {
    it("1年分の日付を返す（閏年）", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getDailyActivity(2024);

      // 2024年は閏年なので366日
      expect(result.length).toBe(366);
      // 日付形式の確認
      expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("1年分の日付を返す（平年）", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getDailyActivity(2023);

      // 2023年は平年なので365日
      expect(result.length).toBe(365);
    });

    it("各日に必要なプロパティが設定される", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getDailyActivity(2024);

      for (const day of result) {
        expect(day).toHaveProperty("date");
        expect(day).toHaveProperty("count");
        expect(day).toHaveProperty("level");
        expect(day.level).toBeGreaterThanOrEqual(0);
        expect(day.level).toBeLessThanOrEqual(4);
      }
    });

    it("活動がない日は count が 0", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getDailyActivity(2024);

      for (const day of result) {
        expect(day.count).toBe(0);
        expect(day.level).toBe(0);
      }
    });
  });

  // ============================================
  // getTrendStats のテスト
  // ============================================
  describe("getTrendStats", () => {
    it("空の結果を返す場合", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getTrendStats("month", { start: 0, end: 100 });
      expect(result).toEqual([]);
    });

    it("月ごとのトレンドを返す", async () => {
      const mockData = [
        { clusterId: 1, createdAt: 1705276800 }, // 2024-01
        { clusterId: 1, createdAt: 1705363200 }, // 2024-01
        { clusterId: 2, createdAt: 1707955200 }, // 2024-02
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockData);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getTrendStats("month", { start: 0, end: Date.now() / 1000 });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("period");
      expect(result[0]).toHaveProperty("clusterId");
      expect(result[0]).toHaveProperty("count");
    });

    it("週ごとのトレンドを返す", async () => {
      const mockData = [
        { clusterId: 1, createdAt: 1705276800 },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockData);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getTrendStats("week", { start: 0, end: Date.now() / 1000 });

      expect(result.length).toBe(1);
      expect(result[0].period).toMatch(/^\d{4}-W\d{2}$/);
    });

    it("期間とクラスタでソートされる", async () => {
      const mockData = [
        { clusterId: 2, createdAt: 1705276800 },
        { clusterId: 1, createdAt: 1705276800 },
        { clusterId: 1, createdAt: 1707955200 },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockData);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getTrendStats("month", { start: 0, end: Date.now() / 1000 });

      // 期間順、同一期間内はクラスタID順
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1];
        const curr = result[i];
        if (prev.period === curr.period) {
          expect(prev.clusterId).toBeLessThanOrEqual(curr.clusterId);
        } else {
          expect(prev.period.localeCompare(curr.period)).toBeLessThanOrEqual(0);
        }
      }
    });
  });

  // ============================================
  // getSummaryStats のテスト
  // ============================================
  describe("getSummaryStats", () => {
    it("サマリー統計を返す", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 10 }]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getSummaryStats();

      expect(result).toHaveProperty("totalNotes");
      expect(result).toHaveProperty("notesLast30Days");
      expect(result).toHaveProperty("changesLast30Days");
      expect(result).toHaveProperty("avgSemanticDiffLast30Days");
    });

    it("空のデータベースの場合は 0 を返す", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getSummaryStats();

      expect(result.totalNotes).toBe(0);
    });
  });
});
