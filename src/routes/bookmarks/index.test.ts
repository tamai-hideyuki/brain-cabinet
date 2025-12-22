/**
 * Bookmarks Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/bookmark", () => ({
  getBookmarkTree: vi.fn(),
  getBookmarkNodeById: vi.fn(),
  createBookmarkNode: vi.fn(),
  updateBookmarkNode: vi.fn(),
  deleteBookmarkNode: vi.fn(),
  moveBookmarkNode: vi.fn(),
  reorderBookmarkNodes: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { bookmarksRoute } from "./index";
import * as bookmarkService from "../../services/bookmark";

describe("bookmarksRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("ツリー構造を返す", async () => {
      const mockTree = [
        { id: "1", name: "Folder 1", type: "folder", children: [] },
      ];
      vi.mocked(bookmarkService.getBookmarkTree).mockResolvedValue(mockTree as any);

      const res = await bookmarksRoute.request("/");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockTree);
    });

    it("エラー時に500を返す", async () => {
      vi.mocked(bookmarkService.getBookmarkTree).mockRejectedValue(new Error("DB Error"));

      const res = await bookmarksRoute.request("/");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("DB Error");
    });
  });

  describe("GET /:id", () => {
    it("単一ノードを返す", async () => {
      const mockNode = { id: "1", name: "Test Node", type: "folder" };
      vi.mocked(bookmarkService.getBookmarkNodeById).mockResolvedValue(mockNode as any);

      const res = await bookmarksRoute.request("/1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockNode);
      expect(bookmarkService.getBookmarkNodeById).toHaveBeenCalledWith("1");
    });

    it("ノードが見つからない場合404を返す", async () => {
      vi.mocked(bookmarkService.getBookmarkNodeById).mockResolvedValue(null);

      const res = await bookmarksRoute.request("/nonexistent");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Bookmark node not found");
    });
  });

  describe("POST /", () => {
    it("新規ノードを作成する", async () => {
      const mockCreated = { id: "new-1", name: "New Folder", type: "folder" };
      vi.mocked(bookmarkService.createBookmarkNode).mockResolvedValue(mockCreated as any);

      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "folder", name: "New Folder" }),
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toEqual(mockCreated);
    });

    it("typeが欠けている場合400を返す", async () => {
      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Folder" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("type and name are required");
    });

    it("nameが欠けている場合400を返す", async () => {
      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "folder" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("type and name are required");
    });

    it("type=noteでnoteIdが欠けている場合400を返す", async () => {
      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", name: "Note Bookmark" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("noteId is required for note type");
    });

    it("type=linkでurlが欠けている場合400を返す", async () => {
      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "link", name: "Link Bookmark" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("url is required for link type");
    });

    it("noteタイプを正しく作成する", async () => {
      const mockCreated = { id: "new-1", name: "Note", type: "note", noteId: "note-1" };
      vi.mocked(bookmarkService.createBookmarkNode).mockResolvedValue(mockCreated as any);

      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "note", name: "Note", noteId: "note-1" }),
      });

      expect(res.status).toBe(201);
      expect(bookmarkService.createBookmarkNode).toHaveBeenCalledWith({
        parentId: null,
        type: "note",
        name: "Note",
        noteId: "note-1",
        url: null,
      });
    });

    it("linkタイプを正しく作成する", async () => {
      const mockCreated = { id: "new-1", name: "Link", type: "link", url: "https://example.com" };
      vi.mocked(bookmarkService.createBookmarkNode).mockResolvedValue(mockCreated as any);

      const res = await bookmarksRoute.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "link", name: "Link", url: "https://example.com" }),
      });

      expect(res.status).toBe(201);
      expect(bookmarkService.createBookmarkNode).toHaveBeenCalledWith({
        parentId: null,
        type: "link",
        name: "Link",
        noteId: null,
        url: "https://example.com",
      });
    });
  });

  describe("PUT /:id", () => {
    it("ノードを更新する", async () => {
      const mockUpdated = { id: "1", name: "Updated Name", type: "folder" };
      vi.mocked(bookmarkService.updateBookmarkNode).mockResolvedValue(mockUpdated as any);

      const res = await bookmarksRoute.request("/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockUpdated);
      expect(bookmarkService.updateBookmarkNode).toHaveBeenCalledWith("1", {
        name: "Updated Name",
        isExpanded: undefined,
      });
    });

    it("isExpandedを更新できる", async () => {
      const mockUpdated = { id: "1", name: "Folder", isExpanded: false };
      vi.mocked(bookmarkService.updateBookmarkNode).mockResolvedValue(mockUpdated as any);

      const res = await bookmarksRoute.request("/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isExpanded: false }),
      });

      expect(bookmarkService.updateBookmarkNode).toHaveBeenCalledWith("1", {
        name: undefined,
        isExpanded: false,
      });
    });
  });

  describe("DELETE /:id", () => {
    it("ノードを削除する", async () => {
      vi.mocked(bookmarkService.deleteBookmarkNode).mockResolvedValue();

      const res = await bookmarksRoute.request("/1", {
        method: "DELETE",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Bookmark node deleted");
      expect(bookmarkService.deleteBookmarkNode).toHaveBeenCalledWith("1");
    });
  });

  describe("POST /:id/move", () => {
    it("ノードを移動する", async () => {
      const mockMoved = { id: "1", parentId: "parent-1", position: 2 };
      vi.mocked(bookmarkService.moveBookmarkNode).mockResolvedValue(mockMoved as any);

      const res = await bookmarksRoute.request("/1/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: "parent-1", position: 2 }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual(mockMoved);
      expect(bookmarkService.moveBookmarkNode).toHaveBeenCalledWith("1", "parent-1", 2);
    });

    it("parentIdがnullの場合ルートに移動する", async () => {
      const mockMoved = { id: "1", parentId: null, position: 0 };
      vi.mocked(bookmarkService.moveBookmarkNode).mockResolvedValue(mockMoved as any);

      const res = await bookmarksRoute.request("/1/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: 0 }),
      });

      expect(bookmarkService.moveBookmarkNode).toHaveBeenCalledWith("1", null, 0);
    });
  });

  describe("POST /reorder", () => {
    it("並び順を更新する", async () => {
      vi.mocked(bookmarkService.reorderBookmarkNodes).mockResolvedValue();

      const res = await bookmarksRoute.request("/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: "parent-1", orderedIds: ["a", "b", "c"] }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Reordered successfully");
      expect(bookmarkService.reorderBookmarkNodes).toHaveBeenCalledWith("parent-1", ["a", "b", "c"]);
    });

    it("orderedIdsが配列でない場合400を返す", async () => {
      const res = await bookmarksRoute.request("/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: "parent-1", orderedIds: "not-an-array" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("orderedIds must be an array");
    });

    it("parentIdがnullの場合ルートの並び順を更新する", async () => {
      vi.mocked(bookmarkService.reorderBookmarkNodes).mockResolvedValue();

      const res = await bookmarksRoute.request("/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ["a", "b", "c"] }),
      });

      expect(bookmarkService.reorderBookmarkNodes).toHaveBeenCalledWith(null, ["a", "b", "c"]);
    });
  });
});
