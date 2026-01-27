/**
 * Bookmark Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findAll,
  findById,
  findMaxPosition,
  findChildrenIds,
  insert,
  update,
  deleteById,
  findFolderByName,
  findAllFolderPositions,
  findAllFolderColors,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      leftJoin: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
        where: vi.fn().mockResolvedValue([]),
      }),
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  const mockDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  return {
    db: {
      select: mockSelect,
      update: mockUpdate,
      insert: mockInsert,
      delete: mockDelete,
    },
  };
});

import { db } from "../../db/client";

describe("bookmarkRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findAll", () => {
    it("全ブックマークノードを取得する", async () => {
      const mockRows = [
        {
          id: "node-1",
          parentId: null,
          type: "folder",
          name: "Folder 1",
          noteId: null,
          url: null,
          position: 0,
          isExpanded: 1,
          createdAt: 1000,
          updatedAt: 1000,
          noteTitle: null,
          noteCategory: null,
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockRows);
      const mockLeftJoin = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAll();

      expect(result).toEqual(mockRows);
      expect(db.select).toHaveBeenCalled();
    });

    it("ノードがない場合は空配列を返す", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockLeftJoin = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findById", () => {
    it("IDでノードを取得する", async () => {
      const mockRow = {
        id: "node-1",
        parentId: null,
        type: "folder",
        name: "Folder 1",
        noteId: null,
        url: null,
        position: 0,
        isExpanded: 1,
        createdAt: 1000,
        updatedAt: 1000,
        noteTitle: null,
        noteCategory: null,
      };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findById("node-1");

      expect(result).toEqual(mockRow);
    });

    it("存在しないIDはnullを返す", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findMaxPosition", () => {
    it("同階層の最大positionを取得する", async () => {
      const mockRows = [{ position: 0 }, { position: 1 }, { position: 2 }];

      const mockOrderBy = vi.fn().mockResolvedValue(mockRows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findMaxPosition(null);

      expect(result).toBe(2);
    });

    it("ノードがない場合は-1を返す", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findMaxPosition("parent-id");

      expect(result).toBe(-1);
    });
  });

  describe("findChildrenIds", () => {
    it("子ノードのIDリストを取得する", async () => {
      const mockRows = [{ id: "child-1" }, { id: "child-2" }];

      const mockWhere = vi.fn().mockResolvedValue(mockRows);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findChildrenIds("parent-id");

      expect(result).toEqual(["child-1", "child-2"]);
    });

    it("子ノードがない場合は空配列を返す", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findChildrenIds("parent-id");

      expect(result).toEqual([]);
    });
  });

  describe("insert", () => {
    it("ノードを挿入する", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      await insert({
        id: "node-1",
        parentId: null,
        type: "folder",
        name: "Folder 1",
        noteId: null,
        url: null,
        position: 0,
        isExpanded: 1,
        createdAt: 1000,
        updatedAt: 1000,
      });

      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        id: "node-1",
        parentId: null,
        type: "folder",
        name: "Folder 1",
        noteId: null,
        url: null,
        position: 0,
        isExpanded: 1,
        createdAt: 1000,
        updatedAt: 1000,
      });
    });
  });

  describe("update", () => {
    it("ノードを更新する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await update("node-1", { name: "Updated Name", updatedAt: 2000 });

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ name: "Updated Name", updatedAt: 2000 });
    });
  });

  describe("deleteById", () => {
    it("ノードを削除する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as any);

      await deleteById("node-1");

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("findFolderByName", () => {
    it("フォルダ名でノードを検索する", async () => {
      const mockRow = { id: "folder-1" };

      const mockWhere = vi.fn().mockResolvedValue([mockRow]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findFolderByName("Test Folder");

      expect(result).toEqual(mockRow);
    });

    it("フォルダが見つからない場合はnullを返す", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findFolderByName("Non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findAllFolderPositions", () => {
    it("全フォルダの位置情報を取得する", async () => {
      const mockRows = [
        { name: "Folder 1", libraryPosition: "[1,2,3]" },
        { name: "Folder 2", libraryPosition: null },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockRows);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllFolderPositions();

      expect(result).toEqual(mockRows);
    });
  });

  describe("findAllFolderColors", () => {
    it("全フォルダの色情報を取得する", async () => {
      const mockRows = [
        { name: "Folder 1", libraryColor: "#ff0000" },
        { name: "Folder 2", libraryColor: null },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockRows);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllFolderColors();

      expect(result).toEqual(mockRows);
    });
  });
});
