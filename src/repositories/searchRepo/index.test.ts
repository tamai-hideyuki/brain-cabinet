/**
 * Search Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchNotesInDB, searchNotesWithLike } from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return {
    db: {
      select: mockSelect,
    },
  };
});

vi.mock("../ftsRepo", () => ({
  searchFTS: vi.fn().mockResolvedValue([]),
}));

import { db } from "../../db/client";
import { searchFTS } from "../ftsRepo";

describe("searchRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchNotesInDB", () => {
    it("空のクエリで空配列を返す", async () => {
      const result = await searchNotesInDB("");

      expect(result).toEqual([]);
      expect(searchFTS).not.toHaveBeenCalled();
    });

    it("空白のみのクエリで空配列を返す", async () => {
      const result = await searchNotesInDB("   ");

      expect(result).toEqual([]);
    });

    it("FTSで検索してノートを取得する", async () => {
      const mockFtsResults = [
        { noteId: "note-1", rank: -1.5 },
        { noteId: "note-2", rank: -1.2 },
      ];
      vi.mocked(searchFTS).mockResolvedValue(mockFtsResults);

      const mockNotes = [
        { id: "note-1", title: "Title 1", content: "Content", category: "技術", tags: null },
        { id: "note-2", title: "Title 2", content: "Content", category: "仕事", tags: null },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test");

      expect(searchFTS).toHaveBeenCalledWith("test");
      expect(result).toHaveLength(2);
    });

    it("FTSでヒットしない場合はLIKE検索にフォールバック", async () => {
      vi.mocked(searchFTS).mockResolvedValue([]);

      const mockNotes = [
        { id: "note-1", title: "Test Title", content: "Content", category: "技術", tags: null },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test");

      expect(searchFTS).toHaveBeenCalled();
      expect(db.select).toHaveBeenCalled();
    });

    it("カテゴリフィルターを適用する", async () => {
      const mockFtsResults = [
        { noteId: "note-1", rank: -1.5 },
        { noteId: "note-2", rank: -1.2 },
      ];
      vi.mocked(searchFTS).mockResolvedValue(mockFtsResults);

      const mockNotes = [
        { id: "note-1", title: "Title 1", content: "Content", category: "技術", tags: null },
        { id: "note-2", title: "Title 2", content: "Content", category: "仕事", tags: null },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test", { category: "技術" });

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("技術");
    });

    it("タグフィルターを適用する", async () => {
      const mockFtsResults = [
        { noteId: "note-1", rank: -1.5 },
        { noteId: "note-2", rank: -1.2 },
      ];
      vi.mocked(searchFTS).mockResolvedValue(mockFtsResults);

      const mockNotes = [
        { id: "note-1", title: "Title 1", content: "Content", category: "技術", tags: '["react","typescript"]' },
        { id: "note-2", title: "Title 2", content: "Content", category: "仕事", tags: '["diary"]' },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test", { tags: ["react"] });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("note-1");
    });

    it("タグフィルターはAND条件で適用する", async () => {
      const mockFtsResults = [
        { noteId: "note-1", rank: -1.5 },
      ];
      vi.mocked(searchFTS).mockResolvedValue(mockFtsResults);

      const mockNotes = [
        { id: "note-1", title: "Title 1", content: "Content", category: "技術", tags: '["react","typescript"]' },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test", { tags: ["react", "typescript"] });

      expect(result).toHaveLength(1);
    });

    it("タグがnullのノートはフィルタリングで除外される", async () => {
      const mockFtsResults = [
        { noteId: "note-1", rank: -1.5 },
      ];
      vi.mocked(searchFTS).mockResolvedValue(mockFtsResults);

      const mockNotes = [
        { id: "note-1", title: "Title 1", content: "Content", category: "技術", tags: null },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test", { tags: ["react"] });

      expect(result).toHaveLength(0);
    });

    it("FTSのrank順にソートする", async () => {
      const mockFtsResults = [
        { noteId: "note-2", rank: -0.5 }, // 低いrank = 関連度低
        { noteId: "note-1", rank: -1.5 }, // 高いrank = 関連度高
      ];
      vi.mocked(searchFTS).mockResolvedValue(mockFtsResults);

      const mockNotes = [
        { id: "note-1", title: "Title 1", content: "Content", category: "技術", tags: null },
        { id: "note-2", title: "Title 2", content: "Content", category: "仕事", tags: null },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesInDB("test");

      // rankが低い順（関連度高い順）にソート
      expect(result[0].id).toBe("note-1");
      expect(result[1].id).toBe("note-2");
    });

    it("useFTS=falseの場合はLIKE検索を使用する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Test Title", content: "Content", category: "tech", tags: null },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await searchNotesInDB("test", { useFTS: false });

      expect(searchFTS).not.toHaveBeenCalled();
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("searchNotesWithLike", () => {
    it("LIKE検索でノートを取得する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Test Title", content: "Content" },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await searchNotesWithLike("test");

      expect(result).toEqual(mockNotes);
      expect(db.select).toHaveBeenCalled();
    });

    it("カテゴリフィルターを適用する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Test", content: "Content", category: "tech" },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await searchNotesWithLike("test", { category: "技術" });

      expect(db.select).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it("タグフィルターを適用する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Test", content: "Content", tags: '["react"]' },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await searchNotesWithLike("test", { tags: ["react"] });

      expect(db.select).toHaveBeenCalled();
    });

    it("複数タグでフィルターを適用する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Test", content: "Content", tags: '["react","vue"]' },
      ];
      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await searchNotesWithLike("test", { tags: ["react", "vue"] });

      expect(db.select).toHaveBeenCalled();
    });
  });
});
