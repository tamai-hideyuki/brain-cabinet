/**
 * GPT判断コーチング機能のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { coachDecision } from "./index";

// モック
vi.mock("../../decision", () => ({
  searchDecisions: vi.fn(),
  getDecisionContext: vi.fn(),
}));

import { searchDecisions, getDecisionContext } from "../../decision";

describe("coachDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("関連する判断がない場合、適切なアドバイスを返す", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([]);

    const result = await coachDecision("新しいフレームワークを採用すべきか");

    expect(result.query).toBe("新しいフレームワークを採用すべきか");
    expect(result.pastDecisions).toHaveLength(0);
    expect(result.coachingAdvice).toContain("見つかりませんでした");
    expect(result.coachingAdvice).toContain("新しいフレームワークを採用すべきか");
  });

  it("関連する判断がある場合、それを含めて返す", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([
      {
        noteId: "decision-1",
        title: "React vs Vue の選定",
        confidence: 0.85,
        confidenceDetail: {
          structural: 0.8,
          experiential: 0.9,
          temporal: 0.85,
        },
        decayProfile: "slow",
        effectiveScore: 0.8,
        reasoning: "チームの経験とエコシステムを考慮",
        excerpt: "Reactを採用することに決定した",
      },
    ] as any);
    vi.mocked(getDecisionContext).mockResolvedValue({
      relatedLearnings: [],
    } as any);

    const result = await coachDecision("フレームワーク選定");

    expect(result.pastDecisions).toHaveLength(1);
    expect(result.pastDecisions[0]).toMatchObject({
      noteId: "decision-1",
      title: "React vs Vue の選定",
      confidence: 0.85,
    });
    expect(result.coachingAdvice).toContain("1件の判断");
    expect(result.coachingAdvice).toContain("React vs Vue の選定");
  });

  it("複数の判断がある場合、すべて含める", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([
      {
        noteId: "decision-1",
        title: "判断1",
        confidence: 0.9,
        decayProfile: "slow",
        effectiveScore: 0.85,
        reasoning: "理由1",
        excerpt: "内容1",
      },
      {
        noteId: "decision-2",
        title: "判断2",
        confidence: 0.7,
        decayProfile: "medium",
        effectiveScore: 0.6,
        reasoning: "理由2",
        excerpt: "内容2",
      },
    ] as any);
    vi.mocked(getDecisionContext).mockResolvedValue({
      relatedLearnings: [],
    } as any);

    const result = await coachDecision("テスト");

    expect(result.pastDecisions).toHaveLength(2);
    expect(result.coachingAdvice).toContain("2件の判断");
    expect(result.coachingAdvice).toContain("他にも1件");
  });

  it("関連する学習ノートを収集する", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([
      {
        noteId: "decision-1",
        title: "判断1",
        confidence: 0.9,
        decayProfile: "slow",
        effectiveScore: 0.85,
        reasoning: "理由",
        excerpt: "内容",
      },
    ] as any);
    vi.mocked(getDecisionContext).mockResolvedValue({
      relatedLearnings: [
        { noteId: "learning-1", title: "学習1", excerpt: "学習内容1" },
        { noteId: "learning-2", title: "学習2", excerpt: "学習内容2" },
      ],
    } as any);

    const result = await coachDecision("テスト");

    expect(result.relatedLearnings).toHaveLength(2);
    expect(result.relatedLearnings[0].noteId).toBe("learning-1");
    expect(result.coachingAdvice).toContain("学習ノートが2件");
  });

  it("重複する学習ノートは除外する", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([
      {
        noteId: "decision-1",
        title: "判断1",
        confidence: 0.9,
        decayProfile: "slow",
        effectiveScore: 0.85,
        reasoning: "理由",
        excerpt: "内容",
      },
      {
        noteId: "decision-2",
        title: "判断2",
        confidence: 0.8,
        decayProfile: "slow",
        effectiveScore: 0.75,
        reasoning: "理由2",
        excerpt: "内容2",
      },
    ] as any);
    vi.mocked(getDecisionContext)
      .mockResolvedValueOnce({
        relatedLearnings: [
          { noteId: "learning-1", title: "学習1", excerpt: "内容1" },
        ],
      } as any)
      .mockResolvedValueOnce({
        relatedLearnings: [
          { noteId: "learning-1", title: "学習1", excerpt: "内容1" }, // 重複
          { noteId: "learning-2", title: "学習2", excerpt: "内容2" },
        ],
      } as any);

    const result = await coachDecision("テスト");

    expect(result.relatedLearnings).toHaveLength(2);
    const noteIds = result.relatedLearnings.map(l => l.noteId);
    expect(noteIds).toContain("learning-1");
    expect(noteIds).toContain("learning-2");
  });

  it("学習ノートは最大5件まで返す", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([
      {
        noteId: "decision-1",
        title: "判断1",
        confidence: 0.9,
        decayProfile: "slow",
        effectiveScore: 0.85,
        reasoning: "理由",
        excerpt: "内容",
      },
    ] as any);
    vi.mocked(getDecisionContext).mockResolvedValue({
      relatedLearnings: Array.from({ length: 10 }, (_, i) => ({
        noteId: `learning-${i}`,
        title: `学習${i}`,
        excerpt: `内容${i}`,
      })),
    } as any);

    const result = await coachDecision("テスト");

    expect(result.relatedLearnings).toHaveLength(5);
  });

  it("getDecisionContextがnullを返す場合も正常に動作する", async () => {
    vi.mocked(searchDecisions).mockResolvedValue([
      {
        noteId: "decision-1",
        title: "判断1",
        confidence: 0.9,
        decayProfile: "slow",
        effectiveScore: 0.85,
        reasoning: "理由",
        excerpt: "内容",
      },
    ] as any);
    vi.mocked(getDecisionContext).mockResolvedValue(null);

    const result = await coachDecision("テスト");

    expect(result.relatedLearnings).toHaveLength(0);
    expect(result.pastDecisions).toHaveLength(1);
  });
});
