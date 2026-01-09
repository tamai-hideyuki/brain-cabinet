/**
 * GPT向け検索機能のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchForGPT, searchForGPTWithInference } from "./index";

// モック
vi.mock("../../../repositories/searchRepo", () => ({
  searchNotesInDB: vi.fn(),
}));

vi.mock("../../../repositories/historyRepo", () => ({
  findHistoryByNoteId: vi.fn(),
}));

vi.mock("../../../utils/normalize", () => ({
  normalizeForGPT: vi.fn((content: string) => content),
}));

vi.mock("../../inference", () => ({
  getLatestInference: vi.fn(),
  classify: vi.fn(),
  getSearchPriority: vi.fn(),
}));

import { searchNotesInDB } from "../../../repositories/searchRepo";
import { findHistoryByNoteId } from "../../../repositories/historyRepo";
import { getLatestInference, classify, getSearchPriority } from "../../inference";

// テスト用ヘルパー: 必須フィールドを持つモックノートを生成
const createMockNote = (overrides: {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string;
  headings?: string;
  perspective?: string | null;
  updatedAt?: number;
  deletedAt?: number | null;
}) => ({
  id: overrides.id,
  title: overrides.title,
  path: `/notes/${overrides.id}.md`,
  content: overrides.content,
  category: overrides.category ?? "tech",
  tags: overrides.tags ?? JSON.stringify([]),
  headings: overrides.headings ?? JSON.stringify([]),
  clusterId: null,
  perspective: overrides.perspective ?? null,
  createdAt: 1700000000,
  updatedAt: overrides.updatedAt ?? 1700000000,
  deletedAt: overrides.deletedAt ?? null,
});

describe("searchForGPT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("検索結果を正しくフォーマットする", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "テストノート",
        content: "これはテスト内容です",
        tags: JSON.stringify(["test", "sample"]),
        headings: JSON.stringify(["見出し1"]),
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);

    const result = await searchForGPT({ query: "テスト" });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      id: "note-1",
      title: "テストノート",
      category: "tech",
      tags: ["test", "sample"],
      headings: ["見出し1"],
    });
    expect(result.totalFound).toBe(1);
    expect(result.searchContext).toContain("テスト");
  });

  it("タイトルマッチでhigh relevanceになる", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "JavaScript入門",
        content: "プログラミングの基礎",
        tags: JSON.stringify(["javascript"]),
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);

    const result = await searchForGPT({ query: "javascript" });

    expect(result.results[0].relevance).toBe("high");
  });

  it("コンテンツのみマッチでlow relevanceになる", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "プログラミング入門",
        content: "pythonの基礎を学ぶ",
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);

    const result = await searchForGPT({ query: "python" });

    expect(result.results[0].relevance).toBe("low");
  });

  it("limitオプションが正しく動作する", async () => {
    const mockNotes = Array.from({ length: 20 }, (_, i) =>
      createMockNote({
        id: `note-${i}`,
        title: `ノート${i}`,
        content: "テスト内容",
      })
    );

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);

    const result = await searchForGPT({ query: "テスト", limit: 5 });

    expect(result.results).toHaveLength(5);
    expect(result.totalFound).toBe(20);
  });

  it("includeHistoryがtrueの場合、履歴数を含める", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "テストノート",
        content: "テスト内容",
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);
    vi.mocked(findHistoryByNoteId).mockResolvedValue([
      { id: "h1" },
      { id: "h2" },
      { id: "h3" },
    ] as any);

    const result = await searchForGPT({
      query: "テスト",
      includeHistory: true,
    });

    expect(result.results[0].historyCount).toBe(3);
  });

  it("結果をrelevance順にソートする", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "その他のノート",
        content: "検索ワード含む",
      }),
      createMockNote({
        id: "note-2",
        title: "検索ワードを含むタイトル",
        content: "内容",
        tags: JSON.stringify(["検索ワード"]),
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);

    const result = await searchForGPT({ query: "検索ワード" });

    // タイトル+タグでマッチする方が先に来る
    expect(result.results[0].id).toBe("note-2");
    expect(result.results[0].relevance).toBe("high");
  });
});

describe("searchForGPTWithInference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("推論情報を付与して返す", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "判断ノート",
        content: "テスト内容",
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);
    vi.mocked(getLatestInference).mockResolvedValue({
      type: "decision",
      intent: "選択",
      confidence: 0.9,
      confidenceDetail: {
        structural: 0.8,
        experiential: 0.9,
        temporal: 0.85,
      },
      decayProfile: "slow",
    } as any);
    vi.mocked(classify).mockReturnValue({
      primaryType: "decision",
      reliability: "high",
    } as any);
    vi.mocked(getSearchPriority).mockReturnValue(90);

    const result = await searchForGPTWithInference({ query: "テスト" });

    expect(result.results[0]).toMatchObject({
      noteType: "decision",
      intent: "選択",
      typeConfidence: 0.9,
      searchPriority: 90,
    });
  });

  it("推論情報がない場合はデフォルト値を使用", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "通常ノート",
        content: "テスト内容",
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);
    vi.mocked(getLatestInference).mockResolvedValue(null);

    const result = await searchForGPTWithInference({ query: "テスト" });

    expect(result.results[0].searchPriority).toBe(50);
    expect(result.results[0].noteType).toBeUndefined();
  });

  it("searchPriority順にソートする", async () => {
    const mockNotes = [
      createMockNote({
        id: "note-1",
        title: "通常ノート",
        content: "テスト",
      }),
      createMockNote({
        id: "note-2",
        title: "判断ノート",
        content: "テスト",
      }),
    ];

    vi.mocked(searchNotesInDB).mockResolvedValue(mockNotes);
    vi.mocked(getLatestInference)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        type: "decision",
        confidence: 0.9,
      } as any);
    vi.mocked(classify).mockReturnValue({
      primaryType: "decision",
      reliability: "high",
    } as any);
    vi.mocked(getSearchPriority).mockReturnValue(90);

    const result = await searchForGPTWithInference({ query: "テスト" });

    // 判断ノート（priority 90）が先に来る
    expect(result.results[0].id).toBe("note-2");
    expect(result.results[0].searchPriority).toBe(90);
  });
});
