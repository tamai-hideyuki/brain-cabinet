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
    const merged = (results[0] as { _hybridSources: string[] })._hybridSources;
    expect(merged).toContain("keyword");
    expect(merged).toContain("semantic");
  });

  it("RRF: keyword単独ヒットがsemanticの床値に埋もれない", async () => {
    // 旧実装のバグ: keyword の絶対スコアが semantic の最低スコア (約32) より低いと
    // 上位に来れなかった。RRFは順位ベースなのでスケール差は無関係。
    vi.mocked(searchNotesInDB).mockResolvedValue([
      buildNote("kw-only-rare"), // keyword 1位 (唯一のヒット、TF-IDFが低くても)
    ] as any);
    vi.mocked(searchSimilarNotes).mockResolvedValue([
      // semantic は別の20件を返す (keyword単独ヒットは含まない)
      ...Array.from({ length: 20 }, (_, i) => ({
        noteId: `sem-${i}`,
        similarity: 0.8,
      })),
    ]);
    vi.mocked(findNoteById).mockImplementation(async (id: string) =>
      buildNote(id) as any
    );

    const results = await searchNotesHybrid("レアフレーズ");

    // keyword 1位のノートは hybrid でも上位に残るべき
    // (RRFスコア 1/61 ≈ 0.0164 は semantic 1位 1/61 と同等)
    const kwOnly = results.find((r) => (r as { id: string }).id === "kw-only-rare");
    const kwOnlyIndex = results.findIndex((r) => (r as { id: string }).id === "kw-only-rare");
    expect(kwOnly).toBeDefined();
    // semantic 1位と同点 (両方rank=1) になるので、上位2位のどちらかに位置する
    expect(kwOnlyIndex).toBeLessThan(2);
  });

  it("RRF: 両方上位にあるノートは単独ヒットより明確に上位になる", async () => {
    // 両モードで rank=1 のノートは RRF: 2/61 ≈ 0.0328
    // 片方のみ rank=1: 1/61 ≈ 0.0164
    vi.mocked(searchNotesInDB).mockResolvedValue([
      buildNote("both-top"),    // keyword 1位
      buildNote("kw-only"),      // keyword 2位
    ] as any);
    vi.mocked(searchSimilarNotes).mockResolvedValue([
      { noteId: "both-top", similarity: 0.9 }, // semantic 1位
      { noteId: "sem-only", similarity: 0.8 },  // semantic 2位
    ]);
    vi.mocked(findNoteById).mockImplementation(async (id: string) =>
      buildNote(id) as any
    );

    const results = await searchNotesHybrid("テスト");

    // both-top が必ず1位
    expect((results[0] as { id: string }).id).toBe("both-top");
    // both-top のスコアは他より明確に大きい
    const topScore = (results[0] as { score: number }).score;
    const secondScore = (results[1] as { score: number }).score;
    expect(topScore).toBeGreaterThan(secondScore);
  });
});
