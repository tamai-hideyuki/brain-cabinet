/**
 * Decision Dispatcher のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/decision", () => ({
  searchDecisions: vi.fn(),
  getDecisionContext: vi.fn(),
  getPromotionCandidates: vi.fn(),
  compareDecisions: vi.fn(),
}));

vi.mock("../../services/counterevidence", () => ({
  addCounterevidence: vi.fn(),
  getCounterevidences: vi.fn(),
  deleteCounterevidence: vi.fn(),
}));

import { decisionDispatcher } from "./index";
import * as decisionService from "../../services/decision";
import * as counterevidence from "../../services/counterevidence";

describe("decisionDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("search", () => {
    it("queryが空の場合エラーを投げる", async () => {
      await expect(decisionDispatcher.search({ query: "" })).rejects.toThrow();
    });

    it("queryがない場合エラーを投げる", async () => {
      await expect(decisionDispatcher.search({})).rejects.toThrow();
    });

    it("searchDecisionsを呼び出す", async () => {
      vi.mocked(decisionService.searchDecisions).mockResolvedValue([]);

      await decisionDispatcher.search({ query: "test" });

      expect(decisionService.searchDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 0.4,
        limit: 50,
      });
    });

    it("intentオプションを渡す", async () => {
      vi.mocked(decisionService.searchDecisions).mockResolvedValue([]);

      await decisionDispatcher.search({ query: "test", intent: "architecture" });

      expect(decisionService.searchDecisions).toHaveBeenCalledWith("test", {
        intent: "architecture",
        minConfidence: 0.4,
        limit: 50,
      });
    });

    it("不正なintentの場合エラーを投げる", async () => {
      await expect(
        decisionDispatcher.search({ query: "test", intent: "invalid" as any })
      ).rejects.toThrow();
    });

    it("minConfidenceを範囲内にクリップする（0未満）", async () => {
      vi.mocked(decisionService.searchDecisions).mockResolvedValue([]);

      await decisionDispatcher.search({ query: "test", minConfidence: -0.5 });

      expect(decisionService.searchDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 0,
        limit: 50,
      });
    });

    it("minConfidenceを範囲内にクリップする（1超過）", async () => {
      vi.mocked(decisionService.searchDecisions).mockResolvedValue([]);

      await decisionDispatcher.search({ query: "test", minConfidence: 1.5 });

      expect(decisionService.searchDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 1,
        limit: 50,
      });
    });

    it("limitを渡す", async () => {
      vi.mocked(decisionService.searchDecisions).mockResolvedValue([]);

      await decisionDispatcher.search({ query: "test", limit: 10 });

      expect(decisionService.searchDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 0.4,
        limit: 10,
      });
    });

    it("limit=0でundefinedを渡す", async () => {
      vi.mocked(decisionService.searchDecisions).mockResolvedValue([]);

      await decisionDispatcher.search({ query: "test", limit: 0 });

      expect(decisionService.searchDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 0.4,
        limit: undefined,
      });
    });
  });

  describe("context", () => {
    it("noteIdがない場合エラーを投げる", async () => {
      await expect(decisionDispatcher.context({})).rejects.toThrow("noteId");
    });

    it("getDecisionContextを呼び出す", async () => {
      const mockContext = { noteId: "note-1", decision: {} };
      vi.mocked(decisionService.getDecisionContext).mockResolvedValue(mockContext as any);

      const result = await decisionDispatcher.context({ noteId: "note-1" });

      expect(decisionService.getDecisionContext).toHaveBeenCalledWith("note-1");
      expect(result).toEqual(mockContext);
    });

    it("コンテキストが見つからない場合エラーを投げる", async () => {
      vi.mocked(decisionService.getDecisionContext).mockResolvedValue(null);

      await expect(decisionDispatcher.context({ noteId: "note-1" })).rejects.toThrow(
        "Decision context not found"
      );
    });
  });

  describe("promotionCandidates", () => {
    it("デフォルトでlimit=10を使用", async () => {
      vi.mocked(decisionService.getPromotionCandidates).mockResolvedValue([]);

      await decisionDispatcher.promotionCandidates(undefined);

      expect(decisionService.getPromotionCandidates).toHaveBeenCalledWith(10);
    });

    it("指定されたlimitを使用", async () => {
      vi.mocked(decisionService.getPromotionCandidates).mockResolvedValue([]);

      await decisionDispatcher.promotionCandidates({ limit: 5 });

      expect(decisionService.getPromotionCandidates).toHaveBeenCalledWith(5);
    });

    it("limit=0でデフォルトの10を使用", async () => {
      vi.mocked(decisionService.getPromotionCandidates).mockResolvedValue([]);

      await decisionDispatcher.promotionCandidates({ limit: 0 });

      expect(decisionService.getPromotionCandidates).toHaveBeenCalledWith(10);
    });
  });

  describe("compare", () => {
    it("queryが空の場合エラーを投げる", async () => {
      await expect(decisionDispatcher.compare({ query: "" })).rejects.toThrow();
    });

    it("compareDecisionsを呼び出す", async () => {
      vi.mocked(decisionService.compareDecisions).mockResolvedValue([]);

      await decisionDispatcher.compare({ query: "test" });

      expect(decisionService.compareDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 0.3,
        limit: 5,
      });
    });

    it("intentを渡す", async () => {
      vi.mocked(decisionService.compareDecisions).mockResolvedValue([]);

      await decisionDispatcher.compare({ query: "test", intent: "design" });

      expect(decisionService.compareDecisions).toHaveBeenCalledWith("test", {
        intent: "design",
        minConfidence: 0.3,
        limit: 5,
      });
    });

    it("limit=0でデフォルトの5を使用", async () => {
      vi.mocked(decisionService.compareDecisions).mockResolvedValue([]);

      await decisionDispatcher.compare({ query: "test", limit: 0 });

      expect(decisionService.compareDecisions).toHaveBeenCalledWith("test", {
        intent: undefined,
        minConfidence: 0.3,
        limit: 5,
      });
    });
  });

  describe("addCounterevidence", () => {
    it("decisionNoteIdがない場合エラーを投げる", async () => {
      await expect(
        decisionDispatcher.addCounterevidence({
          type: "regret",
          content: "test",
        })
      ).rejects.toThrow("decisionNoteId");
    });

    it("typeがない場合エラーを投げる", async () => {
      await expect(
        decisionDispatcher.addCounterevidence({
          decisionNoteId: "note-1",
          content: "test",
        })
      ).rejects.toThrow("type is required");
    });

    it("contentがない場合エラーを投げる", async () => {
      await expect(
        decisionDispatcher.addCounterevidence({
          decisionNoteId: "note-1",
          type: "regret",
        })
      ).rejects.toThrow("content");
    });

    it("addCounterevidencelを呼び出す", async () => {
      const mockResult = { id: 1, decisionNoteId: "note-1" };
      vi.mocked(counterevidence.addCounterevidence).mockResolvedValue(mockResult as any);

      const result = await decisionDispatcher.addCounterevidence({
        decisionNoteId: "note-1",
        type: "regret",
        content: "Test content",
      });

      expect(counterevidence.addCounterevidence).toHaveBeenCalledWith({
        decisionNoteId: "note-1",
        type: "regret",
        content: "Test content",
        sourceNoteId: undefined,
        severity: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it("オプションのフィールドを渡す", async () => {
      const mockResult = { id: 1, decisionNoteId: "note-1" };
      vi.mocked(counterevidence.addCounterevidence).mockResolvedValue(mockResult as any);

      await decisionDispatcher.addCounterevidence({
        decisionNoteId: "note-1",
        type: "missed_alternative",
        content: "Test content",
        sourceNoteId: "source-1",
        severity: "major",
      });

      expect(counterevidence.addCounterevidence).toHaveBeenCalledWith({
        decisionNoteId: "note-1",
        type: "missed_alternative",
        content: "Test content",
        sourceNoteId: "source-1",
        severity: "major",
      });
    });
  });

  describe("getCounterevidences", () => {
    it("decisionNoteIdがない場合エラーを投げる", async () => {
      await expect(decisionDispatcher.getCounterevidences({})).rejects.toThrow(
        "decisionNoteId"
      );
    });

    it("getCounterevidencelを呼び出す", async () => {
      const mockResult = [{ id: 1, content: "test" }];
      vi.mocked(counterevidence.getCounterevidences).mockResolvedValue(mockResult as any);

      const result = await decisionDispatcher.getCounterevidences({
        decisionNoteId: "note-1",
      });

      expect(counterevidence.getCounterevidences).toHaveBeenCalledWith("note-1");
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteCounterevidence", () => {
    it("idがない場合エラーを投げる", async () => {
      await expect(decisionDispatcher.deleteCounterevidence({})).rejects.toThrow(
        "id is required"
      );
    });

    it("idが数値でない場合エラーを投げる", async () => {
      await expect(
        decisionDispatcher.deleteCounterevidence({ id: "1" as any })
      ).rejects.toThrow("id is required");
    });

    it("deleteCounterevidencelを呼び出す", async () => {
      vi.mocked(counterevidence.deleteCounterevidence).mockResolvedValue();

      const result = await decisionDispatcher.deleteCounterevidence({ id: 1 });

      expect(counterevidence.deleteCounterevidence).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true, message: "Counterevidence deleted" });
    });
  });
});
