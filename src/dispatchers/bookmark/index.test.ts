/**
 * Bookmark Dispatcher のテスト
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
  updateLibraryPosition: vi.fn(),
  getLibraryPositions: vi.fn(),
  updateLibraryColor: vi.fn(),
  getLibraryColors: vi.fn(),
}));

import { bookmarkDispatcher } from "./index";
import * as bookmarkService from "../../services/bookmark";

describe("bookmarkDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateLibraryColor", () => {
    describe("バリデーション", () => {
      it("folderNameが空の場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ folderName: "", color: "#FF5733" })
        ).rejects.toThrow("folderName is required");
      });

      it("folderNameがない場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ color: "#FF5733" })
        ).rejects.toThrow("folderName is required");
      });

      it("colorが空の場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ folderName: "Test", color: "" })
        ).rejects.toThrow("color must be a valid hex color");
      });

      it("colorがない場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ folderName: "Test" })
        ).rejects.toThrow("color must be a valid hex color");
      });

      it("colorが不正な形式の場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ folderName: "Test", color: "red" })
        ).rejects.toThrow("color must be a valid hex color");
      });

      it("colorが3桁の場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ folderName: "Test", color: "#FFF" })
        ).rejects.toThrow("color must be a valid hex color");
      });

      it("colorが#なしの場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryColor({ folderName: "Test", color: "FF5733" })
        ).rejects.toThrow("color must be a valid hex color");
      });
    });

    describe("正常系", () => {
      it("有効な色でサービスを呼び出す", async () => {
        vi.mocked(bookmarkService.updateLibraryColor).mockResolvedValue({ success: true });

        await bookmarkDispatcher.updateLibraryColor({
          folderName: "TestFolder",
          color: "#FF5733",
        });

        expect(bookmarkService.updateLibraryColor).toHaveBeenCalledWith("TestFolder", "#FF5733");
      });

      it("小文字のhexも受け付ける", async () => {
        vi.mocked(bookmarkService.updateLibraryColor).mockResolvedValue({ success: true });

        await bookmarkDispatcher.updateLibraryColor({
          folderName: "TestFolder",
          color: "#ff5733",
        });

        expect(bookmarkService.updateLibraryColor).toHaveBeenCalledWith("TestFolder", "#ff5733");
      });

      it("大文字小文字混在のhexも受け付ける", async () => {
        vi.mocked(bookmarkService.updateLibraryColor).mockResolvedValue({ success: true });

        await bookmarkDispatcher.updateLibraryColor({
          folderName: "TestFolder",
          color: "#Ff5733",
        });

        expect(bookmarkService.updateLibraryColor).toHaveBeenCalledWith("TestFolder", "#Ff5733");
      });

      it("日本語のフォルダ名を受け付ける", async () => {
        vi.mocked(bookmarkService.updateLibraryColor).mockResolvedValue({ success: true });

        await bookmarkDispatcher.updateLibraryColor({
          folderName: "ブックマーク",
          color: "#F59E0B",
        });

        expect(bookmarkService.updateLibraryColor).toHaveBeenCalledWith("ブックマーク", "#F59E0B");
      });
    });
  });

  describe("getLibraryColors", () => {
    it("サービスを呼び出して結果を返す", async () => {
      const mockColors = {
        "フォルダ1": "#FF5733",
        "フォルダ2": "#3B82F6",
      };
      vi.mocked(bookmarkService.getLibraryColors).mockResolvedValue(mockColors);

      const result = await bookmarkDispatcher.getLibraryColors({});

      expect(bookmarkService.getLibraryColors).toHaveBeenCalled();
      expect(result).toEqual(mockColors);
    });

    it("空のオブジェクトを返す場合", async () => {
      vi.mocked(bookmarkService.getLibraryColors).mockResolvedValue({});

      const result = await bookmarkDispatcher.getLibraryColors({});

      expect(result).toEqual({});
    });
  });

  describe("updateLibraryPosition", () => {
    describe("バリデーション", () => {
      it("folderNameがない場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryPosition({ position: [0, 0, 0] })
        ).rejects.toThrow("folderName is required");
      });

      it("positionが配列でない場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryPosition({ folderName: "Test", position: "invalid" })
        ).rejects.toThrow("position must be [x, y, z] array");
      });

      it("positionの長さが3でない場合エラーを投げる", async () => {
        await expect(
          bookmarkDispatcher.updateLibraryPosition({ folderName: "Test", position: [0, 0] })
        ).rejects.toThrow("position must be [x, y, z] array");
      });
    });

    describe("正常系", () => {
      it("有効な位置でサービスを呼び出す", async () => {
        vi.mocked(bookmarkService.updateLibraryPosition).mockResolvedValue({ success: true });

        await bookmarkDispatcher.updateLibraryPosition({
          folderName: "TestFolder",
          position: [10, 0, -20],
        });

        expect(bookmarkService.updateLibraryPosition).toHaveBeenCalledWith(
          "TestFolder",
          [10, 0, -20]
        );
      });
    });
  });

  describe("getLibraryPositions", () => {
    it("サービスを呼び出して結果を返す", async () => {
      const mockPositions = {
        "フォルダ1": [0, 0, 0] as [number, number, number],
        "フォルダ2": [60, 0, 0] as [number, number, number],
      };
      vi.mocked(bookmarkService.getLibraryPositions).mockResolvedValue(mockPositions);

      const result = await bookmarkDispatcher.getLibraryPositions({});

      expect(bookmarkService.getLibraryPositions).toHaveBeenCalled();
      expect(result).toEqual(mockPositions);
    });
  });
});
