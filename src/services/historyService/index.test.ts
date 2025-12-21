/**
 * History Service のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveNoteHistory,
  getNoteHistory,
  getNoteHistoryPaginated,
  getSingleHistory,
  getHistoryHtmlDiff,
  getHistoryById,
  getNoteWithHistory,
} from "./index";

// モック
vi.mock("../../repositories/historyRepo", () => ({
  insertHistory: vi.fn(),
  findHistoryByNoteId: vi.fn(),
  findHistoryById: vi.fn(),
  countHistoryByNoteId: vi.fn(),
}));

vi.mock("../../repositories/notesRepo", () => ({
  findNoteById: vi.fn(),
}));

vi.mock("../../utils/diff", () => ({
  computeHtmlDiff: vi.fn((old: string, current: string) => `<diff>${old} → ${current}</diff>`),
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "mock-uuid-123"),
}));

import {
  insertHistory,
  findHistoryByNoteId,
  findHistoryById,
  countHistoryByNoteId,
} from "../../repositories/historyRepo";
import { findNoteById } from "../../repositories/notesRepo";

describe("saveNoteHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("履歴を保存する", async () => {
    vi.mocked(insertHistory).mockResolvedValue(undefined as any);

    await saveNoteHistory({
      noteId: "note-1",
      content: "テスト内容",
    });

    expect(insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mock-uuid-123",
        noteId: "note-1",
        content: "テスト内容",
        diff: null,
      })
    );
  });

  it("diffを指定して保存できる", async () => {
    vi.mocked(insertHistory).mockResolvedValue(undefined as any);

    await saveNoteHistory({
      noteId: "note-1",
      content: "テスト内容",
      diff: "変更差分",
    });

    expect(insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: "変更差分",
      })
    );
  });
});

describe("getNoteHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ノートの履歴を取得する", async () => {
    const mockHistories = [
      { id: "h1", noteId: "note-1", content: "内容1", createdAt: 1700000000 },
      { id: "h2", noteId: "note-1", content: "内容2", createdAt: 1699900000 },
    ];
    vi.mocked(findHistoryByNoteId).mockResolvedValue(mockHistories as any);

    const result = await getNoteHistory("note-1");

    expect(result).toEqual(mockHistories);
    expect(findHistoryByNoteId).toHaveBeenCalledWith("note-1");
  });
});

describe("getNoteHistoryPaginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ページネーション付きで履歴を取得する", async () => {
    vi.mocked(countHistoryByNoteId).mockResolvedValue(50);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1", content: "内容1", diff: null, createdAt: 1700000000 },
    ] as any);

    const result = await getNoteHistoryPaginated("note-1", { limit: 10, offset: 20 });

    expect(result.total).toBe(50);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
    expect(findHistoryByNoteId).toHaveBeenCalledWith("note-1", { limit: 10, offset: 20 });
  });

  it("includeContent=trueでコンテンツを含める", async () => {
    vi.mocked(countHistoryByNoteId).mockResolvedValue(1);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1", content: "テスト内容", diff: "差分", createdAt: 1700000000 },
    ] as any);

    const result = await getNoteHistoryPaginated("note-1", { includeContent: true });

    expect(result.histories[0]).toHaveProperty("content", "テスト内容");
    expect(result.histories[0]).toHaveProperty("contentLength", 5);
  });

  it("デフォルトはincludeContent=falseでコンテンツを除外", async () => {
    vi.mocked(countHistoryByNoteId).mockResolvedValue(1);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1", content: "テスト内容", diff: null, createdAt: 1700000000 },
    ] as any);

    const result = await getNoteHistoryPaginated("note-1");

    expect(result.histories[0]).not.toHaveProperty("content");
    expect(result.histories[0]).toHaveProperty("contentLength", 5);
  });
});

describe("getSingleHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("履歴を1件取得する", async () => {
    vi.mocked(findHistoryById).mockResolvedValue({
      id: "history-1",
      noteId: "note-1",
      content: "過去の内容",
      diff: "差分情報",
      createdAt: 1700000000,
    } as any);

    const result = await getSingleHistory("history-1");

    expect(result).toEqual({
      id: "history-1",
      noteId: "note-1",
      content: "過去の内容",
      diffSummary: "差分情報",
      createdAt: 1700000000,
    });
  });

  it("履歴が見つからない場合はエラー", async () => {
    vi.mocked(findHistoryById).mockResolvedValue(null as any);

    await expect(getSingleHistory("not-found")).rejects.toThrow("History not found");
  });
});

describe("getHistoryHtmlDiff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("履歴と現在のノートの差分HTMLを返す", async () => {
    vi.mocked(findHistoryById).mockResolvedValue({
      id: "history-1",
      noteId: "note-1",
      content: "過去の内容",
    } as any);
    vi.mocked(findNoteById).mockResolvedValue({
      id: "note-1",
      content: "現在の内容",
    } as any);

    const result = await getHistoryHtmlDiff("history-1");

    expect(result.historyId).toBe("history-1");
    expect(result.noteId).toBe("note-1");
    expect(result.html).toContain("過去の内容");
    expect(result.html).toContain("現在の内容");
  });

  it("履歴が見つからない場合はエラー", async () => {
    vi.mocked(findHistoryById).mockResolvedValue(null as any);

    await expect(getHistoryHtmlDiff("not-found")).rejects.toThrow("History not found");
  });

  it("ノートが見つからない場合はエラー", async () => {
    vi.mocked(findHistoryById).mockResolvedValue({
      id: "history-1",
      noteId: "note-1",
      content: "過去の内容",
    } as any);
    vi.mocked(findNoteById).mockResolvedValue(null as any);

    await expect(getHistoryHtmlDiff("history-1")).rejects.toThrow("Note not found");
  });
});

describe("getHistoryById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("履歴IDで履歴を取得する", async () => {
    const mockHistory = {
      id: "history-1",
      noteId: "note-1",
      content: "内容",
      createdAt: 1700000000,
    };
    vi.mocked(findHistoryById).mockResolvedValue(mockHistory as any);

    const result = await getHistoryById("history-1");

    expect(result).toEqual(mockHistory);
  });
});

describe("getNoteWithHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ノートと最新の履歴を取得する", async () => {
    vi.mocked(findNoteById).mockResolvedValue({
      id: "note-1",
      title: "テストノート",
      path: "/notes/test.md",
      content: "現在の内容",
      tags: JSON.stringify(["tag1"]),
      category: "tech",
      headings: JSON.stringify(["見出し1"]),
      createdAt: 1700000000,
      updatedAt: 1700000000,
    } as any);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1", createdAt: 1699900000 },
      { id: "h2", createdAt: 1699800000 },
      { id: "h3", createdAt: 1699700000 },
      { id: "h4", createdAt: 1699600000 },
    ] as any);

    const result = await getNoteWithHistory("note-1", 3);

    expect(result.note.title).toBe("テストノート");
    expect(result.note.tags).toEqual(["tag1"]);
    expect(result.histories).toHaveLength(3);
    expect(result.totalHistories).toBe(4);
  });

  it("ノートが見つからない場合はエラー", async () => {
    vi.mocked(findNoteById).mockResolvedValue(null as any);

    await expect(getNoteWithHistory("not-found")).rejects.toThrow("Note not found");
  });
});
