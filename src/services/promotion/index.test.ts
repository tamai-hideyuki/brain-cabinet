/**
 * Promotion Service のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InferenceResult } from "../inference/inferNoteType";

// モック
vi.mock("../../db/client", () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

import { db } from "../../db/client";
import { checkPromotionTriggers, type CheckTriggerResult } from "./index";

describe("promotionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkPromotionTriggers", () => {
    // ヘルパー関数: InferenceResult を生成
    const createInference = (
      overrides: Partial<InferenceResult> = {}
    ): InferenceResult => ({
      type: "scratch",
      confidence: 0.5,
      reasoning: "テスト推論",
      confidenceDetail: {
        structural: 0.3,
        experiential: 0.2,
        temporal: 0.1,
      },
      intent: "unknown",
      decayProfile: "exploratory",
      ...overrides,
    });

    describe("scratch以外のタイプの場合", () => {
      it("shouldNotify: false を返す (decision)", async () => {
        const mockWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const inference = createInference({ type: "decision" });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(false);
      });

      it("shouldNotify: false を返す (learning)", async () => {
        const mockWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const inference = createInference({ type: "learning" });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(false);
      });
    });

    describe("confidence が閾値未満の場合", () => {
      it("confidence 0.54 で shouldNotify: false を返す", async () => {
        const mockWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const inference = createInference({ confidence: 0.54 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(false);
      });

      it("confidence 0 で shouldNotify: false を返す", async () => {
        const mockWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const inference = createInference({ confidence: 0 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(false);
      });
    });

    describe("既存のpending通知がある場合", () => {
      it("shouldNotify: false を返す", async () => {
        const mockLimit = vi.fn().mockResolvedValue([{ id: 1 }]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

        const inference = createInference({ confidence: 0.6 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(false);
      });
    });

    describe("昇格候補として検出される場合", () => {
      beforeEach(() => {
        // pending 通知なしをモック
        const mockLimit = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
      });

      it("confidence 0.55以上で shouldNotify: true を返す", async () => {
        const inference = createInference({ confidence: 0.55 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.triggerType).toBe("confidence_rise");
      });

      it("confidence 0.9 でも shouldNotify: true を返す", async () => {
        const inference = createInference({ confidence: 0.9 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
      });

      it("判断表現がある場合、suggestedType に decision を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          reasoning: "判断表現が含まれています",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("decision");
      });

      it("intent が architecture の場合、suggestedType に decision を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          intent: "architecture",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("decision");
      });

      it("intent が design の場合、suggestedType に decision を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          intent: "design",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("decision");
      });

      it("学習表現がある場合、suggestedType に learning を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          reasoning: "学習表現が含まれています",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("learning");
      });

      it("intent が implementation の場合、suggestedType に learning を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          intent: "implementation",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("learning");
      });

      it("intent が review の場合、suggestedType に learning を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          intent: "review",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("learning");
      });

      it("デフォルトでは suggestedType に learning を設定", async () => {
        const inference = createInference({
          confidence: 0.6,
          intent: "unknown",
          reasoning: "通常の推論",
        });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.shouldNotify).toBe(true);
        expect(result.suggestedType).toBe("learning");
      });

      it("reason が設定される", async () => {
        const inference = createInference({ confidence: 0.6 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.reason).toBeDefined();
        expect(typeof result.reason).toBe("string");
        expect(result.reason!.length).toBeGreaterThan(0);
      });

      it("reasonDetail に confidenceDelta が含まれる（前回推論なし）", async () => {
        const inference = createInference({ confidence: 0.6 });

        const result = await checkPromotionTriggers("note-1", inference, null);

        expect(result.reasonDetail).toBeDefined();
        expect(result.reasonDetail!.confidenceDelta).toBe(0);
        expect(result.reasonDetail!.previousConfidence).toBeUndefined();
      });

      it("reasonDetail に confidenceDelta が含まれる（前回推論あり）", async () => {
        const currentInference = createInference({ confidence: 0.7 });
        const previousInference = createInference({ confidence: 0.5 });

        const result = await checkPromotionTriggers(
          "note-1",
          currentInference,
          previousInference
        );

        expect(result.reasonDetail).toBeDefined();
        expect(result.reasonDetail!.confidenceDelta).toBe(0.2);
        expect(result.reasonDetail!.previousConfidence).toBe(0.5);
      });

      it("confidenceが大きく上昇した場合、適切な reason を生成", async () => {
        const currentInference = createInference({ confidence: 0.7 });
        const previousInference = createInference({ confidence: 0.5 });

        const result = await checkPromotionTriggers(
          "note-1",
          currentInference,
          previousInference
        );

        expect(result.reason).toContain("大きく上昇");
        expect(result.reason).toContain("+20%");
      });

      it("structural >= 0.3 の場合、断定的な表現の reason を生成", async () => {
        const inference = createInference({
          confidence: 0.6,
          confidenceDetail: {
            structural: 0.35,
            experiential: 0.2,
            temporal: 0.1,
          },
        });
        const previousInference = createInference({ confidence: 0.55 });

        const result = await checkPromotionTriggers(
          "note-1",
          inference,
          previousInference
        );

        expect(result.reason).toContain("断定的な表現");
      });
    });
  });
});
