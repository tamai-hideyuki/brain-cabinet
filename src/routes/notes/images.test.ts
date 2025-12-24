/**
 * Note Images Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockGetNoteImages,
  mockGetNoteImage,
  mockGetNoteImageData,
  mockUploadNoteImage,
  mockRemoveNoteImage,
} = vi.hoisted(() => ({
  mockGetNoteImages: vi.fn(),
  mockGetNoteImage: vi.fn(),
  mockGetNoteImageData: vi.fn(),
  mockUploadNoteImage: vi.fn(),
  mockRemoveNoteImage: vi.fn(),
}));

// モック
vi.mock("../../services/noteImages", () => ({
  getNoteImages: mockGetNoteImages,
  getNoteImage: mockGetNoteImage,
  getNoteImageData: mockGetNoteImageData,
  uploadNoteImage: mockUploadNoteImage,
  removeNoteImage: mockRemoveNoteImage,
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { imagesRoute, noteImagesRoute } from "./images";

describe("imagesRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /:id/data", () => {
    it("画像データを返す", async () => {
      const mockData = Buffer.from("fake-image-data");
      mockGetNoteImageData.mockResolvedValue({
        data: mockData,
        mimeType: "image/png",
        size: mockData.length,
      });

      const res = await imagesRoute.request("/test-id/data");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("画像が見つからない場合404を返す", async () => {
      mockGetNoteImageData.mockRejectedValue(new Error("Not found"));

      const res = await imagesRoute.request("/not-found/data");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Not found");
    });
  });

  describe("GET /:id", () => {
    it("画像メタデータを返す", async () => {
      mockGetNoteImage.mockResolvedValue({
        id: "img-1",
        noteId: "note-1",
        name: "test.png",
        mimeType: "image/png",
        size: 1024,
        createdAt: 1000,
      });

      const res = await imagesRoute.request("/img-1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.id).toBe("img-1");
      expect(json.name).toBe("test.png");
    });

    it("画像が見つからない場合404を返す", async () => {
      mockGetNoteImage.mockRejectedValue(new Error("Not found"));

      const res = await imagesRoute.request("/not-found");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Not found");
    });
  });

  describe("DELETE /:id", () => {
    it("画像を削除する", async () => {
      mockRemoveNoteImage.mockResolvedValue({
        id: "img-1",
        noteId: "note-1",
        name: "test.png",
        mimeType: "image/png",
        size: 1024,
        createdAt: 1000,
      });

      const res = await imagesRoute.request("/img-1", { method: "DELETE" });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.id).toBe("img-1");
    });

    it("削除失敗時に400を返す", async () => {
      mockRemoveNoteImage.mockRejectedValue(new Error("Delete failed"));

      const res = await imagesRoute.request("/img-1", { method: "DELETE" });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Delete failed");
    });
  });
});

describe("noteImagesRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /:noteId/images", () => {
    it("ノートの画像一覧を返す", async () => {
      mockGetNoteImages.mockResolvedValue([
        { id: "img-1", noteId: "note-1", name: "test1.png", mimeType: "image/png", size: 1024, createdAt: 1000 },
        { id: "img-2", noteId: "note-1", name: "test2.jpg", mimeType: "image/jpeg", size: 2048, createdAt: 2000 },
      ]);

      const res = await noteImagesRoute.request("/note-1/images");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveLength(2);
      expect(json[0].id).toBe("img-1");
    });

    it("空の配列を返す", async () => {
      mockGetNoteImages.mockResolvedValue([]);

      const res = await noteImagesRoute.request("/note-1/images");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toHaveLength(0);
    });
  });

  describe("POST /:noteId/images", () => {
    it("画像をアップロードする", async () => {
      mockUploadNoteImage.mockResolvedValue({
        id: "img-new",
        noteId: "note-1",
        name: "uploaded.png",
        mimeType: "image/png",
        size: 5000,
        createdAt: 3000,
      });

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/png" }), "test.png");

      const res = await noteImagesRoute.request("/note-1/images", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.id).toBe("img-new");
      expect(json.markdown).toBe("![uploaded.png](note-image://img-new)");
    });

    it("ファイルがない場合400を返す", async () => {
      const formData = new FormData();

      const res = await noteImagesRoute.request("/note-1/images", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("file is required");
    });

    it("アップロード失敗時に400を返す", async () => {
      mockUploadNoteImage.mockRejectedValue(new Error("Upload failed"));

      const formData = new FormData();
      formData.append("file", new Blob(["test"], { type: "image/png" }), "test.png");

      const res = await noteImagesRoute.request("/note-1/images", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Upload failed");
    });
  });
});
