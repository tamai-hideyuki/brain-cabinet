/**
 * Notes History Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/notesService", () => ({
  revertNote: vi.fn(),
}));

vi.mock("../../services/historyService", () => ({
  getNoteHistory: vi.fn(),
  getHistoryHtmlDiff: vi.fn(),
  getNoteFullContext: vi.fn(),
  getNoteWithHistory: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { historyRoute } from "./history";
import { revertNote } from "../../services/notesService";
import * as historyService from "../../services/historyService";

describe("historyRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /:id/history", () => {
    it("履歴一覧を返す", async () => {
      const mockHistory = [
        { id: "h1", noteId: "1", content: "Old content", createdAt: 1000 },
        { id: "h2", noteId: "1", content: "Older content", createdAt: 900 },
      ];
      vi.mocked(historyService.getNoteHistory).mockResolvedValue(mockHistory as any);

      const res = await historyRoute.request("/note-1/history");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockHistory);
      expect(historyService.getNoteHistory).toHaveBeenCalledWith("note-1");
    });

    it("空の履歴を返す", async () => {
      vi.mocked(historyService.getNoteHistory).mockResolvedValue([]);

      const res = await historyRoute.request("/note-1/history");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual([]);
    });
  });

  describe("GET /:id/history/:historyId/diff", () => {
    it("HTML形式の差分を返す", async () => {
      const mockDiff = {
        historyId: "h1",
        oldContent: "Old content",
        newContent: "New content",
        htmlDiff: "<span>diff</span>",
      };
      vi.mocked(historyService.getHistoryHtmlDiff).mockResolvedValue(mockDiff as any);

      const res = await historyRoute.request("/note-1/history/h1/diff");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockDiff);
      expect(historyService.getHistoryHtmlDiff).toHaveBeenCalledWith("h1");
    });

    it("履歴が見つからない場合404を返す", async () => {
      vi.mocked(historyService.getHistoryHtmlDiff).mockRejectedValue(
        new Error("History not found")
      );

      const res = await historyRoute.request("/note-1/history/nonexistent/diff");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("History not found");
    });
  });

  describe("POST /:id/revert/:historyId", () => {
    it("履歴に巻き戻す", async () => {
      const mockReverted = { id: "note-1", content: "Reverted content" };
      vi.mocked(revertNote).mockResolvedValue(mockReverted as any);

      const res = await historyRoute.request("/note-1/revert/h1", {
        method: "POST",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockReverted);
      expect(revertNote).toHaveBeenCalledWith("note-1", "h1");
    });

    it("エラー時に400を返す", async () => {
      vi.mocked(revertNote).mockRejectedValue(new Error("Revert failed"));

      const res = await historyRoute.request("/note-1/revert/h1", {
        method: "POST",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Revert failed");
    });
  });

  describe("GET /:id/with-history", () => {
    it("ノートと最新N件の履歴を返す", async () => {
      const mockResult = {
        note: { id: "note-1", title: "Test", content: "Content" },
        history: [{ id: "h1", content: "Old content" }],
      };
      vi.mocked(historyService.getNoteWithHistory).mockResolvedValue(mockResult as any);

      const res = await historyRoute.request("/note-1/with-history");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockResult);
      expect(historyService.getNoteWithHistory).toHaveBeenCalledWith("note-1", 3);
    });

    it("limitパラメータを渡す", async () => {
      const mockResult = {
        note: { id: "note-1", title: "Test", content: "Content" },
        history: [],
      };
      vi.mocked(historyService.getNoteWithHistory).mockResolvedValue(mockResult as any);

      const res = await historyRoute.request("/note-1/with-history?limit=5");

      expect(historyService.getNoteWithHistory).toHaveBeenCalledWith("note-1", 5);
    });

    it("ノートが見つからない場合404を返す", async () => {
      vi.mocked(historyService.getNoteWithHistory).mockRejectedValue(
        new Error("Note not found")
      );

      const res = await historyRoute.request("/nonexistent/with-history");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Note not found");
    });
  });

  describe("GET /:id/full-context", () => {
    it("ノートと全履歴と差分を返す", async () => {
      const mockContext = {
        note: { id: "note-1", title: "Test", content: "Content" },
        history: [
          { id: "h1", content: "Old", diff: "..." },
        ],
        totalHistoryCount: 1,
      };
      vi.mocked(historyService.getNoteFullContext).mockResolvedValue(mockContext as any);

      const res = await historyRoute.request("/note-1/full-context");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockContext);
      expect(historyService.getNoteFullContext).toHaveBeenCalledWith("note-1");
    });

    it("ノートが見つからない場合404を返す", async () => {
      vi.mocked(historyService.getNoteFullContext).mockRejectedValue(
        new Error("Note not found")
      );

      const res = await historyRoute.request("/nonexistent/full-context");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Note not found");
    });
  });
});
