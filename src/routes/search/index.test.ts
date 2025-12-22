/**
 * Search Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/searchService", () => ({
  searchNotes: vi.fn(),
  searchNotesSemantic: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { searchRoute } from "./index";
import * as searchService from "../../services/searchService";
import { CATEGORIES } from "../../db/schema";

describe("searchRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    describe("keyword検索（デフォルト）", () => {
      it("検索結果を返す", async () => {
        const mockResults = [
          { id: "1", title: "Note 1", score: 1.0 },
          { id: "2", title: "Note 2", score: 0.8 },
        ];
        vi.mocked(searchService.searchNotes).mockResolvedValue(mockResults as any);

        const res = await searchRoute.request("/?query=test");
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual(mockResults);
        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: undefined,
        });
      });

      it("空のクエリでも動作する", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        const res = await searchRoute.request("/");
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual([]);
        expect(searchService.searchNotes).toHaveBeenCalledWith("", {
          category: undefined,
          tags: undefined,
        });
      });

      it("日本語クエリをデコードする", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        const encodedQuery = encodeURIComponent("テスト");
        const res = await searchRoute.request(`/?query=${encodedQuery}`);

        expect(searchService.searchNotes).toHaveBeenCalledWith("テスト", {
          category: undefined,
          tags: undefined,
        });
      });

      it("categoryを渡す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        const encodedCategory = encodeURIComponent("技術");
        const res = await searchRoute.request(`/?query=test&category=${encodedCategory}`);

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: "技術",
          tags: undefined,
        });
      });

      it("不正なcategoryは無視する", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        const res = await searchRoute.request("/?query=test&category=invalid");

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: undefined,
        });
      });

      it("tagsを渡す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        const encodedTags = encodeURIComponent("tag1,tag2,tag3");
        const res = await searchRoute.request(`/?query=test&tags=${encodedTags}`);

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: ["tag1", "tag2", "tag3"],
        });
      });

      it("空のtagsをフィルタする", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);

        const encodedTags = encodeURIComponent("tag1,,tag2, ,tag3");
        const res = await searchRoute.request(`/?query=test&tags=${encodedTags}`);

        expect(searchService.searchNotes).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: ["tag1", "tag2", "tag3"],
        });
      });
    });

    describe("semantic検索", () => {
      it("searchNotesSemanticを呼び出す", async () => {
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([]);

        const res = await searchRoute.request("/?query=test&mode=semantic");

        expect(searchService.searchNotesSemantic).toHaveBeenCalledWith("test", {
          category: undefined,
          tags: undefined,
        });
        expect(searchService.searchNotes).not.toHaveBeenCalled();
      });

      it("検索結果を返す", async () => {
        const mockResults = [{ id: "1", title: "Semantic Result", score: 0.95 }];
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue(mockResults as any);

        const res = await searchRoute.request("/?query=test&mode=semantic");
        const json = await res.json();

        expect(json).toEqual(mockResults);
      });
    });

    describe("hybrid検索", () => {
      it("キーワードと意味検索の両方を呼び出す", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([]);
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([]);

        const res = await searchRoute.request("/?query=test&mode=hybrid");

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

        const res = await searchRoute.request("/?query=test&mode=hybrid");
        const json = await res.json();

        expect(json).toHaveLength(3);
        // Note 1: keyword 1.0*0.6 + semantic 0.9*0.4 = 0.96
        // Note 2: keyword 0.8*0.6 = 0.48
        // Note 3: semantic 0.7*0.4 = 0.28
        expect(json[0].id).toBe("1");
        expect(json[1].id).toBe("2");
        expect(json[2].id).toBe("3");
      });

      it("意味検索が失敗してもキーワード結果を返す", async () => {
        const mockKeywordResults = [{ id: "1", title: "Note 1", score: 1.0 }];
        vi.mocked(searchService.searchNotes).mockResolvedValue(mockKeywordResults as any);
        vi.mocked(searchService.searchNotesSemantic).mockRejectedValue(
          new Error("Semantic search failed")
        );

        const res = await searchRoute.request("/?query=test&mode=hybrid");
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toHaveLength(1);
        expect(json[0].id).toBe("1");
      });

      it("_debugにkeywordScoreとsemanticScoreを含む", async () => {
        vi.mocked(searchService.searchNotes).mockResolvedValue([
          { id: "1", title: "Note 1", score: 1.0, _debug: {} },
        ] as any);
        vi.mocked(searchService.searchNotesSemantic).mockResolvedValue([
          { id: "1", title: "Note 1", score: 0.9, _debug: {} },
        ] as any);

        const res = await searchRoute.request("/?query=test&mode=hybrid");
        const json = await res.json();

        expect(json[0]._debug.keywordScore).toBe(1.0);
        expect(json[0]._debug.semanticScore).toBe(0.9);
      });
    });
  });

  describe("GET /categories", () => {
    it("カテゴリ一覧を返す", async () => {
      const res = await searchRoute.request("/categories");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(CATEGORIES);
    });
  });
});
