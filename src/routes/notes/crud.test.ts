/**
 * Notes CRUD Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// モック
vi.mock("../../services/notesService", () => ({
  getAllNotes: vi.fn(),
  getNoteById: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { crudRoute } from "./crud";
import * as notesService from "../../services/notesService";
import { errorHandler } from "../../middleware/error-handler";
import { ValidationError, NotFoundError, ErrorCodes } from "../../utils/errors";

// エラーハンドラを設定したappを作成
const app = new Hono();
app.onError(errorHandler);
app.route("/", crudRoute);

describe("crudRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("全ノート一覧を返す", async () => {
      const mockNotes = [
        { id: "1", title: "Note 1", content: "Content 1" },
        { id: "2", title: "Note 2", content: "Content 2" },
      ];
      vi.mocked(notesService.getAllNotes).mockResolvedValue(mockNotes as any);

      const response = await crudRoute.request("/");
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual(mockNotes);
    });

    it("空の配列を返す", async () => {
      vi.mocked(notesService.getAllNotes).mockResolvedValue([]);

      const response = await crudRoute.request("/");
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual([]);
    });
  });

  describe("POST /", () => {
    it("新規ノートを作成する", async () => {
      const mockCreated = { id: "new-1", title: "New Note", content: "New Content" };
      vi.mocked(notesService.createNote).mockResolvedValue(mockCreated as any);

      const response = await crudRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Note", content: "New Content" }),
      });
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json).toEqual(mockCreated);
      expect(notesService.createNote).toHaveBeenCalledWith("New Note", "New Content");
    });

    it("エラー時に400を返す", async () => {
      vi.mocked(notesService.createNote).mockRejectedValue(
        new ValidationError("Validation error", "title", ErrorCodes.VALIDATION_REQUIRED)
      );

      const response = await app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", content: "" }),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.message).toBe("Validation error");
      expect(json.error.code).toBe("VALIDATION_REQUIRED");
    });
  });

  describe("GET /:id", () => {
    it("単一ノートを返す", async () => {
      const mockNote = { id: "1", title: "Test Note", content: "Content" };
      vi.mocked(notesService.getNoteById).mockResolvedValue(mockNote as any);

      const response = await crudRoute.request("/1");
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual(mockNote);
      expect(notesService.getNoteById).toHaveBeenCalledWith("1");
    });

    it("ノートが見つからない場合404を返す", async () => {
      vi.mocked(notesService.getNoteById).mockRejectedValue(
        new NotFoundError("Note", "nonexistent")
      );

      const response = await app.request("/nonexistent");
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error.message).toBe("Note not found: nonexistent");
      expect(json.error.code).toBe("NOTE_NOT_FOUND");
    });
  });

  describe("PUT /:id", () => {
    it("ノートを更新する", async () => {
      const mockUpdated = { id: "1", title: "Updated Title", content: "Updated Content" };
      vi.mocked(notesService.updateNote).mockResolvedValue(mockUpdated as any);

      const response = await crudRoute.request("/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title", content: "Updated Content" }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual(mockUpdated);
      expect(notesService.updateNote).toHaveBeenCalledWith("1", "Updated Content", "Updated Title");
    });

    it("contentのみで更新できる", async () => {
      const mockUpdated = { id: "1", title: "Original", content: "Updated Content" };
      vi.mocked(notesService.updateNote).mockResolvedValue(mockUpdated as any);

      const response = await crudRoute.request("/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated Content" }),
      });

      expect(response.status).toBe(200);
      expect(notesService.updateNote).toHaveBeenCalledWith("1", "Updated Content", undefined);
    });

    it("エラー時に400を返す", async () => {
      vi.mocked(notesService.updateNote).mockRejectedValue(
        new ValidationError("Update failed", "content", ErrorCodes.VALIDATION_REQUIRED)
      );

      const response = await app.request("/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.message).toBe("Update failed");
      expect(json.error.code).toBe("VALIDATION_REQUIRED");
    });
  });

  describe("DELETE /:id", () => {
    it("ノートを削除する", async () => {
      const mockDeleted = { id: "1", title: "Deleted Note" };
      vi.mocked(notesService.deleteNote).mockResolvedValue(mockDeleted as any);

      const response = await crudRoute.request("/1", {
        method: "DELETE",
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.message).toBe("Note deleted (can be restored within 1 hour)");
      expect(json.note).toEqual(mockDeleted);
      expect(notesService.deleteNote).toHaveBeenCalledWith("1");
    });

    it("ノートが見つからない場合404を返す", async () => {
      vi.mocked(notesService.deleteNote).mockRejectedValue(
        new NotFoundError("Note", "nonexistent")
      );

      const response = await app.request("/nonexistent", {
        method: "DELETE",
      });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error.message).toBe("Note not found: nonexistent");
      expect(json.error.code).toBe("NOTE_NOT_FOUND");
    });
  });
});
