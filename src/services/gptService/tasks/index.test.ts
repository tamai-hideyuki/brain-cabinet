/**
 * GPT タスク準備・推奨のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { prepareGPTTask, getNotesOverviewForGPT } from "./index";

// モック
vi.mock("../../../repositories/notesRepo", () => ({
  findNoteById: vi.fn(),
  findAllNotes: vi.fn(),
}));

vi.mock("../../../repositories/historyRepo", () => ({
  findHistoryByNoteId: vi.fn(),
}));

vi.mock("../search", () => ({
  searchForGPT: vi.fn(),
}));

vi.mock("../context", () => ({
  getContextForGPT: vi.fn(),
}));

vi.mock("../../ptm/engine", () => ({
  generateMetaStateLite: vi.fn(),
}));

import { findNoteById, findAllNotes } from "../../../repositories/notesRepo";
import { findHistoryByNoteId } from "../../../repositories/historyRepo";
import { searchForGPT } from "../search";
import { getContextForGPT } from "../context";

describe("prepareGPTTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extract_key_points", () => {
    it("noteIdが必須", async () => {
      await expect(
        prepareGPTTask({ type: "extract_key_points" })
      ).rejects.toThrow("noteId is required");
    });

    it("正しいレスポンスを返す", async () => {
      vi.mocked(getContextForGPT).mockResolvedValue({
        note: { title: "テストノート" },
        content: { full: "テスト内容", summary: "要約" },
      } as any);

      const result = await prepareGPTTask({
        type: "extract_key_points",
        noteId: "note-1",
      });

      expect(result.type).toBe("extract_key_points");
      expect(result.instruction).toContain("要点を抽出");
      expect(result.suggestedPrompt).toContain("テストノート");
      expect(result.relatedNoteIds).toContain("note-1");
    });
  });

  describe("summarize", () => {
    it("noteIdが必須", async () => {
      await expect(
        prepareGPTTask({ type: "summarize" })
      ).rejects.toThrow("noteId is required");
    });

    it("正しいレスポンスを返す", async () => {
      vi.mocked(getContextForGPT).mockResolvedValue({
        note: { title: "要約対象ノート" },
        content: { full: "長い内容...", summary: "要約" },
      } as any);

      const result = await prepareGPTTask({
        type: "summarize",
        noteId: "note-1",
      });

      expect(result.type).toBe("summarize");
      expect(result.instruction).toContain("要約");
      expect(result.suggestedPrompt).toContain("要約対象ノート");
    });
  });

  describe("generate_ideas", () => {
    it("関連ノートを含める", async () => {
      vi.mocked(getContextForGPT).mockResolvedValue({
        note: { title: "アイデアの種" },
        content: { summary: "元のアイデア" },
      } as any);
      vi.mocked(searchForGPT).mockResolvedValue({
        results: [
          { id: "related-1", title: "関連1", summary: "内容1" },
          { id: "related-2", title: "関連2", summary: "内容2" },
        ],
        totalFound: 2,
        searchContext: "",
      } as any);

      const result = await prepareGPTTask({
        type: "generate_ideas",
        noteId: "note-1",
      });

      expect(result.relatedNoteIds).toContain("note-1");
      expect(result.relatedNoteIds).toContain("related-1");
      expect(result.relatedNoteIds).toContain("related-2");
      expect(result.context).toContain("関連ノート");
    });
  });

  describe("find_related", () => {
    it("queryまたはnoteIdが必須", async () => {
      await expect(
        prepareGPTTask({ type: "find_related" })
      ).rejects.toThrow("query or noteId is required");
    });

    it("queryで検索する", async () => {
      vi.mocked(searchForGPT).mockResolvedValue({
        results: [
          { id: "r1", title: "結果1", relevance: "high", category: "tech", summary: "内容1" },
        ],
        totalFound: 1,
        searchContext: "",
      } as any);

      const result = await prepareGPTTask({
        type: "find_related",
        query: "TypeScript",
      });

      expect(result.type).toBe("find_related");
      expect(result.suggestedPrompt).toContain("TypeScript");
      expect(searchForGPT).toHaveBeenCalledWith(
        expect.objectContaining({ query: "TypeScript" })
      );
    });

    it("noteIdからタイトルを取得して検索する", async () => {
      vi.mocked(findNoteById).mockResolvedValue({
        id: "note-1",
        title: "JavaScript入門",
      } as any);
      vi.mocked(searchForGPT).mockResolvedValue({
        results: [],
        totalFound: 0,
        searchContext: "",
      } as any);

      const result = await prepareGPTTask({
        type: "find_related",
        noteId: "note-1",
      });

      expect(searchForGPT).toHaveBeenCalledWith(
        expect.objectContaining({ query: "JavaScript入門" })
      );
    });
  });

  describe("compare_versions", () => {
    it("履歴がない場合はエラー", async () => {
      vi.mocked(getContextForGPT).mockResolvedValue({
        note: { title: "ノート" },
        content: { summary: "内容" },
        history: { count: 0, recent: [] },
      } as any);

      await expect(
        prepareGPTTask({ type: "compare_versions", noteId: "note-1" })
      ).rejects.toThrow("No history available");
    });

    it("履歴がある場合は正常に動作", async () => {
      vi.mocked(getContextForGPT).mockResolvedValue({
        note: { title: "変更履歴ノート" },
        content: { summary: "現在の内容" },
        history: {
          count: 2,
          recent: [
            { id: "h1", summary: "過去1" },
            { id: "h2", summary: "過去2" },
          ],
        },
      } as any);

      const result = await prepareGPTTask({
        type: "compare_versions",
        noteId: "note-1",
      });

      expect(result.type).toBe("compare_versions");
      expect(result.context).toContain("現在の内容");
      expect(result.context).toContain("過去のバージョン");
    });
  });

  describe("create_outline", () => {
    it("アウトラインを含むコンテキストを返す", async () => {
      vi.mocked(getContextForGPT).mockResolvedValue({
        note: { title: "アウトライン対象" },
        content: {
          summary: "要約",
          outline: ["# 見出し1", "## 見出し2"],
        },
      } as any);

      const result = await prepareGPTTask({
        type: "create_outline",
        noteId: "note-1",
      });

      expect(result.type).toBe("create_outline");
      expect(result.context).toContain("見出し1");
      expect(result.suggestedPrompt).toContain("アウトライン");
    });
  });

  describe("unknown type", () => {
    it("不明なタイプはエラー", async () => {
      await expect(
        prepareGPTTask({ type: "unknown" as any, noteId: "note-1" })
      ).rejects.toThrow("Unknown task type");
    });
  });
});

describe("getNotesOverviewForGPT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ノートの統計情報を返す", async () => {
    vi.mocked(findAllNotes).mockResolvedValue([
      {
        id: "note-1",
        category: "tech",
        tags: JSON.stringify(["TypeScript", "React"]),
      },
      {
        id: "note-2",
        category: "tech",
        tags: JSON.stringify(["TypeScript"]),
      },
      {
        id: "note-3",
        category: "life",
        tags: JSON.stringify(["健康"]),
      },
    ] as any);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getNotesOverviewForGPT();

    expect(result.totalNotes).toBe(3);
    expect(result.categoryBreakdown).toEqual({
      tech: 2,
      life: 1,
    });
    expect(result.topTags).toContainEqual({ tag: "TypeScript", count: 2 });
    expect(result.gptSummary).toContain("3 件のノート");
  });

  it("履歴の総数を含める", async () => {
    vi.mocked(findAllNotes).mockResolvedValue([
      { id: "note-1", category: "tech", tags: JSON.stringify([]) },
    ] as any);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1" },
      { id: "h2" },
    ] as any);

    const result = await getNotesOverviewForGPT();

    expect(result.totalHistoryEntries).toBe(2);
  });

  it("カテゴリがnullの場合は「その他」として集計", async () => {
    vi.mocked(findAllNotes).mockResolvedValue([
      { id: "note-1", category: null, tags: JSON.stringify([]) },
    ] as any);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getNotesOverviewForGPT();

    expect(result.categoryBreakdown["その他"]).toBe(1);
  });
});
