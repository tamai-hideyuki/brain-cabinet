/**
 * Search Dispatcher のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/searchService", () => ({
  searchNotes: vi.fn(),
  searchNotesSemantic: vi.fn(),
}));

vi.mock("../../repositories/notesRepo", () => ({
  findAllNotes: vi.fn(),
}));

import { searchDispatcher } from "./index";
import * as searchService from "../../services/searchService";
import { findAllNotes } from "../../repositories/notesRepo";
import { CATEGORIES } from "../../db/schema";

describe("searchDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("query", () => {
    describe("バリデーション", () => {
      it("queryが空の場合エラーを投げる", async () => {
        await expect(searchDispatcher.query({ query: "" })).rejects.toThrow();
      });

      it("queryがない場合エラーを投げる", async () => {
        await expect(searchDispatcher.query({})).rejects.toThrow();
      });

      it("不正なmodeの場合エラーを投げる", async () => {
        await expect(
          searchDispatcher.query({ query: "test", mode: "invalid" as any })
        ).rejects.toThrow();
      });

      it("不正なcategoryの場合エラーを投げる", async () => {
        await expect(
          searchDispatcher.query({ query: "test", category: "invalid" as any })
        ).rejects.toThrow();
      });
    });

    describe("keyword検索（デフォルト）", () => {
      it("searchNotesを呼び出す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test" });

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: undefined,
          limit: 50,
        });
      });

      it("mode=keywordでsearchNotesを呼び出す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", mode: "keyword" });

        expect(searchService.searchNotes).toHaveBeenCalled();
        expect(searchService.searchNotesSemantic).not.toHaveBeenCalled();
      });

      it("categoryフィルタを渡す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", category: "技術" });

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: "技術",
          tags: undefined,
          limit: 50,
        });
      });

      it("tagsフィルタを渡す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", tags: ["tag1", "tag2"] });

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: ["tag1", "tag2"],
          limit: 50,
        });
      });

      it("limitを渡す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", limit: 10 });

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: undefined,
          limit: 10,
        });
      });

      it("limit=0でundefinedを渡す（全件取得）", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", limit: 0 });

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: undefined,
          limit: undefined,
        });
      });
    });

    describe("semantic検索", () => {
      it("mode=semanticでsearchNotesSemanticを呼び出す", async () => {
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", mode: "semantic" });

        expect(searchService.searchNotesSemantic).toHaveBeenCalled();
        expect(searchService.searchNotes).not.toHaveBeenCalled();
      });

      it("オプションを正しく渡す", async () => {
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([]);

        await searchDispatcher.query({
          query: "test",
          mode: "semantic",
          category: "学習",
          limit: 20,
        });

        expect(searchService.searchNotesSemantic).toHaveBeenCalledWith("test", {
          category: "学習",
          tags: undefined,
          limit: 20,
        });
      });
    });

    describe("hybrid検索", () => {
      it("keywordとsemantic両方を呼び出す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([]);

        await searchDispatcher.query({ query: "test", mode: "hybrid" });

        expect(searchService.searchNotes).toHaveBeenCalled();
        expect(searchService.searchNotesSemantic).toHaveBeenCalled();
      });

      it("結果をスコアでマージする", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([
          { id: "1", title: "Note 1", score: 1.0 },
          { id: "2", title: "Note 2", score: 0.8 },
        ] as any);
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([
          { id: "1", title: "Note 1", score: 0.9 },
          { id: "3", title: "Note 3", score: 0.7 },
        ] as any);

        const result = await searchDispatcher.query({ query: "test", mode: "hybrid" });

        // Note 1: keyword 1.0*0.6 + semantic 0.9*0.4 = 0.96
        // Note 2: keyword 0.8*0.6 = 0.48
        // Note 3: semantic 0.7*0.4 = 0.28
        expect(result).toHaveLength(3);
        expect((result as any)[0].id).toBe("1");
        expect((result as any)[1].id).toBe("2");
        expect((result as any)[2].id).toBe("3");
      });

      it("重複するノートはスコアを合算する", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([
          { id: "1", title: "Note 1", score: 1.0 },
        ] as any);
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([
          { id: "1", title: "Note 1", score: 1.0 },
        ] as any);

        const result = await searchDispatcher.query({ query: "test", mode: "hybrid" });

        expect(result).toHaveLength(1);
        // 1.0*0.6 + 1.0*0.4 = 1.0
      });
    });
  });

  describe("categories", () => {
    it("カテゴリ一覧を返す", async () => {
      const result = await searchDispatcher.categories();

      expect(result).toEqual({ categories: CATEGORIES });
    });
  });

  describe("byTitle", () => {
    const mockNotes = [
      { id: "1", title: "TypeScript入門", content: "TypeScriptの基礎を学ぶ", createdAt: 1000, updatedAt: 1000 },
      { id: "2", title: "React Hooks", content: "React Hooksの使い方", createdAt: 1000, updatedAt: 1000 },
      { id: "3", title: "typescript Tips", content: "TypeScriptの小技", createdAt: 1000, updatedAt: 1000 },
    ];

    beforeEach(() => {
      vi.mocked(findAllNotes).mockResolvedValue(mockNotes as any);
    });

    it("titleが空の場合エラーを投げる", async () => {
      await expect(searchDispatcher.byTitle({ title: "" })).rejects.toThrow();
    });

    it("部分一致でノートを検索する（デフォルト）", async () => {
      const result = await searchDispatcher.byTitle({ title: "TypeScript" });

      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toContain("1");
      expect(result.map((n) => n.id)).toContain("3");
    });

    it("大文字小文字を区別しない", async () => {
      const result = await searchDispatcher.byTitle({ title: "typescript" });

      expect(result).toHaveLength(2);
    });

    it("exact=trueで完全一致検索する", async () => {
      const result = await searchDispatcher.byTitle({
        title: "TypeScript入門",
        exact: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
    });

    it("limitで結果数を制限する", async () => {
      const result = await searchDispatcher.byTitle({
        title: "TypeScript",
        limit: 1,
      });

      expect(result).toHaveLength(1);
    });

    it("limit=0で全件取得", async () => {
      const result = await searchDispatcher.byTitle({
        title: "TypeScript",
        limit: 0,
      });

      expect(result).toHaveLength(2);
    });

    it("結果にid, title, content (200文字まで), createdAt, updatedAtを含む", async () => {
      const result = await searchDispatcher.byTitle({ title: "TypeScript入門" });

      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("title");
      expect(result[0]).toHaveProperty("content");
      expect(result[0]).toHaveProperty("createdAt");
      expect(result[0]).toHaveProperty("updatedAt");
    });

    it("contentを200文字で切り詰める", async () => {
      const longContent = "a".repeat(300);
      vi.mocked(findAllNotes).mockResolvedValue([
        { id: "1", title: "Test", content: longContent, createdAt: 1000, updatedAt: 1000 },
      ] as any);

      const result = await searchDispatcher.byTitle({ title: "Test" });

      expect(result[0].content.length).toBe(200);
    });
  });
});
