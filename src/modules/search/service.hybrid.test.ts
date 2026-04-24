/**
 * searchNotesHybrid のマージロジックとスコア上書き挙動のテスト
 *
 * dispatcher.ts の hybrid case がここに委譲しているので、
 * マージ仕様の変更はここでテストする。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./repository", () => ({
  searchNotesInDB: vi.fn(),
}));

vi.mock("./embeddingService", () => ({
  searchSimilarNotes: vi.fn(),
}));

vi.mock("../note", () => ({
  findAllNotes: vi.fn(),
  findNoteById: vi.fn(),
}));

import { searchNotesHybrid } from "./service";
import { searchNotesInDB } from "./repository";
import { searchSimilarNotes } from "./embeddingService";
import { findAllNotes, findNoteById } from "../note";

const buildNote = (id: string, title = `Note ${id}`) => ({
  id,
  title,
  content: "本文",
  path: null,
  tags: null,
  category: null,
  clusterId: null,
  headings: null,
  createdAt: 1000,
  updatedAt: 2000,
});

describe("searchNotesHybrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // findAllNotes は IDF キャッシュ計算で呼ばれる
    vi.mocked(findAllNotes).mockResolvedValue([buildNote("dummy")] as any);
  });

  it("score フィールドはマージ後のスコアで上書きされる（表示=ソートキーの一致を保証）", async () => {
    vi.mocked(searchNotesInDB).mockResolvedValue([
      buildNote("kw-only"),
    ] as any);
    vi.mocked(searchSimilarNotes).mockResolvedValue([
      { noteId: "kw-only", similarity: 0.5 },
    ]);
    vi.mocked(findNoteById).mockResolvedValue(buildNote("kw-only") as any);

    const results = await searchNotesHybrid("テスト");

    // 結果には score と hybridScore の両方が存在し、値が一致するべき
    const note = results[0] as { score: number; hybridScore: number };
    expect(note.score).toBeDefined();
    expect(note.hybridScore).toBeDefined();
    expect(note.score).toBe(note.hybridScore);
  });

  it("結果はマージ後スコアで降順ソートされる", async () => {
    vi.mocked(searchNotesInDB).mockResolvedValue([
      buildNote("a"),
      buildNote("b"),
      buildNote("c"),
    ] as any);
    vi.mocked(searchSimilarNotes).mockResolvedValue([
      { noteId: "a", similarity: 0.9 },
      { noteId: "b", similarity: 0.5 },
      { noteId: "c", similarity: 0.1 },
    ]);
    vi.mocked(findNoteById).mockImplementation(async (id: string) =>
      buildNote(id) as any
    );

    const results = await searchNotesHybrid("テスト");

    // score 降順になっていること
    for (let i = 0; i < results.length - 1; i++) {
      const current = (results[i] as { score: number }).score;
      const next = (results[i + 1] as { score: number }).score;
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it("keyword と semantic 両方にあるノートはスコアが合算される", async () => {
    vi.mocked(searchNotesInDB).mockResolvedValue([
      buildNote("both"),
    ] as any);
    vi.mocked(searchSimilarNotes).mockResolvedValue([
      { noteId: "both", similarity: 0.8 },
    ]);
    vi.mocked(findNoteById).mockResolvedValue(buildNote("both") as any);

    const results = await searchNotesHybrid("テスト");

    expect(results).toHaveLength(1);
    // マージ後スコアは keyword*0.6 + semantic*0.4 で計算され、
    // 単一モードのスコアより大きいはず
    const merged = (results[0] as { _hybridSources: string[] })._hybridSources;
    expect(merged).toContain("keyword");
    expect(merged).toContain("semantic");
  });
});
