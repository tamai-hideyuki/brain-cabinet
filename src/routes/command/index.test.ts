/**
 * Command Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const { mockDispatch, mockGetAvailableActions } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockGetAvailableActions: vi.fn(),
}));

// モック
vi.mock("../../dispatchers", () => ({
  dispatch: mockDispatch,
  getAvailableActions: mockGetAvailableActions,
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import commandRoute from "./index";

describe("commandRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /", () => {
    it("正常なコマンドを処理する", async () => {
      mockDispatch.mockResolvedValue({
        success: true,
        data: { id: "note-1" },
        timestamp: Date.now(),
      });

      const res = await commandRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "note.create",
          payload: { title: "Test", content: "Test content" },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("note-1");
    });

    it("無効なJSONで400を返す", async () => {
      const res = await commandRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INVALID_JSON");
    });

    it("actionがない場合400を返す", async () => {
      const res = await commandRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: {} }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("MISSING_ACTION");
    });

    it("actionの形式が不正な場合400を返す", async () => {
      const res = await commandRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invalid" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INVALID_ACTION_FORMAT");
    });

    it("dispatchが失敗した場合400を返す", async () => {
      mockDispatch.mockResolvedValue({
        success: false,
        error: { code: "NOT_FOUND", message: "Note not found" },
        timestamp: Date.now(),
      });

      const res = await commandRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "note.get",
          payload: { id: "non-existent" },
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /actions", () => {
    it("利用可能なアクション一覧を返す", async () => {
      mockGetAvailableActions.mockReturnValue([
        "note.create",
        "note.get",
        "note.update",
        "cluster.rebuild",
      ]);

      const res = await commandRoute.request("/actions");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.total).toBe(4);
      expect(json.domains).toContain("note");
      expect(json.domains).toContain("cluster");
      expect(json.actions.note).toContain("note.create");
    });

    it("空のアクション一覧を返す", async () => {
      mockGetAvailableActions.mockReturnValue([]);

      const res = await commandRoute.request("/actions");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.total).toBe(0);
      expect(json.domains).toEqual([]);
    });
  });
});
