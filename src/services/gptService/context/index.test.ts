/**
 * GPT向けコンテキスト抽出のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContextForGPT } from "./index";

// モック
vi.mock("../../../repositories/notesRepo", () => ({
  findNoteById: vi.fn(),
}));

vi.mock("../../../repositories/historyRepo", () => ({
  findHistoryByNoteId: vi.fn(),
}));

vi.mock("../../../utils/markdown", () => ({
  normalizeMarkdown: vi.fn((content: string) => content),
  formatForGPT: vi.fn((content: string) => content),
  extractOutline: vi.fn(() => ["見出し1", "見出し2"]),
  extractBulletPoints: vi.fn(() => ["ポイント1", "ポイント2"]),
}));

vi.mock("../../../utils/normalize", () => ({
  normalizeForGPT: vi.fn((content: string) => content),
}));

import { findNoteById } from "../../../repositories/notesRepo";
import { findHistoryByNoteId } from "../../../repositories/historyRepo";

// テスト用ヘルパー
const createMockNote = (overrides: Partial<{
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string | null;
  headings: string | null;
  createdAt: number;
  updatedAt: number;
}> = {}) => ({
  id: overrides.id ?? "note-1",
  title: overrides.title ?? "テストノート",
  path: "/notes/test.md",
  content: overrides.content ?? "テスト内容です。",
  category: overrides.category ?? "tech",
  tags: overrides.tags ?? JSON.stringify(["tag1", "tag2"]),
  headings: overrides.headings ?? JSON.stringify(["見出し1"]),
  clusterId: null,
  createdAt: overrides.createdAt ?? 1700000000,
  updatedAt: overrides.updatedAt ?? 1700000000,
});

describe("getContextForGPT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ノートのコンテキストを正しく取得する", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getContextForGPT("note-1");

    expect(result.note).toMatchObject({
      id: "note-1",
      title: "テストノート",
      category: "tech",
      tags: ["tag1", "tag2"],
    });
    expect(result.content.summary).toBeDefined();
    expect(result.gptInstruction).toContain("テストノート");
  });

  it("ノートが見つからない場合はエラーを投げる", async () => {
    vi.mocked(findNoteById).mockResolvedValue(null);

    await expect(getContextForGPT("not-found")).rejects.toThrow("Note not found");
  });

  it("includeFullContentがtrueの場合、全文を含める", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote({
      content: "これは長いコンテンツです。",
    }));
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getContextForGPT("note-1", { includeFullContent: true });

    expect(result.content.full).toBeDefined();
  });

  it("includeFullContentがfalseの場合、全文を含めない", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getContextForGPT("note-1", { includeFullContent: false });

    expect(result.content.full).toBeUndefined();
  });

  it("includeOutlineがtrueの場合、アウトラインを含める", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getContextForGPT("note-1", { includeOutline: true });

    expect(result.content.outline).toEqual(["見出し1", "見出し2"]);
  });

  it("includeBulletPointsがtrueの場合、箇条書きを含める", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getContextForGPT("note-1", { includeBulletPoints: true });

    expect(result.content.bulletPoints).toEqual(["ポイント1", "ポイント2"]);
  });

  it("includeHistoryがtrueの場合、履歴を含める", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1", content: "過去の内容1", createdAt: 1699900000 },
      { id: "h2", content: "過去の内容2", createdAt: 1699800000 },
    ] as any);

    const result = await getContextForGPT("note-1", { includeHistory: true });

    expect(result.history).toBeDefined();
    expect(result.history?.count).toBe(2);
    expect(result.history?.recent).toHaveLength(2);
  });

  it("historyLimitで履歴の件数を制限できる", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1", content: "内容1", createdAt: 1699900000 },
      { id: "h2", content: "内容2", createdAt: 1699800000 },
      { id: "h3", content: "内容3", createdAt: 1699700000 },
      { id: "h4", content: "内容4", createdAt: 1699600000 },
    ] as any);

    const result = await getContextForGPT("note-1", {
      includeHistory: true,
      historyLimit: 2,
    });

    expect(result.history?.count).toBe(4);
    expect(result.history?.recent).toHaveLength(2);
  });

  it("includeHistoryがfalseの場合、履歴を含めない", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote());

    const result = await getContextForGPT("note-1", { includeHistory: false });

    expect(result.history).toBeUndefined();
    expect(findHistoryByNoteId).not.toHaveBeenCalled();
  });

  it("gptInstructionにノート情報が含まれる", async () => {
    vi.mocked(findNoteById).mockResolvedValue(createMockNote({
      title: "重要なメモ",
      category: "work",
      tags: JSON.stringify(["会議", "TODO"]),
    }));
    vi.mocked(findHistoryByNoteId).mockResolvedValue([]);

    const result = await getContextForGPT("note-1");

    expect(result.gptInstruction).toContain("重要なメモ");
    expect(result.gptInstruction).toContain("work");
    expect(result.gptInstruction).toContain("会議");
  });
});
