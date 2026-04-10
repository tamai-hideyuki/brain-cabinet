/**
 * Notes Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findAllNotes,
  findNoteById,
  findNotesByIds,
  findAllNoteClusterIds,
  updateNotesCategoryInDB,
} from "./repository";

// モック
vi.mock("../../shared/db/client", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
      orderBy: vi.fn().mockResolvedValue([]),
    }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    db: {
      select: mockSelect,
      update: mockUpdate,
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

vi.mock("../../shared/utils/metadata", () => ({
  extractMetadata: vi.fn(() => ({
    tags: ["test"],
    category: "tech",
    headings: ["Heading 1"],
  })),
}));

vi.mock("../search", () => ({
  insertFTSRaw: vi.fn(),
  updateFTSRaw: vi.fn(),
  deleteFTSRaw: vi.fn(),
}));

vi.mock("./historyRepository", () => ({
  deleteHistoryByNoteIdRaw: vi.fn(),
}));

vi.mock("../note", () => ({
  deleteAllRelationsForNoteRaw: vi.fn(),
}));

vi.mock("../cluster", () => ({
  deleteClusterHistoryByNoteIdRaw: vi.fn(),
}));

vi.mock("../search", () => ({
  deleteEmbeddingRaw: vi.fn(),
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "mock-uuid-123"),
}));

import { db } from "../../shared/db/client";

describe("notesRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findAllNotes", () => {
    it("全ノートを取得する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Note 1", content: "Content 1" },
        { id: "note-2", title: "Note 2", content: "Content 2" },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockNotes);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllNotes();

      expect(result).toEqual(mockNotes);
      expect(db.select).toHaveBeenCalled();
    });

    it("ノートがない場合は空配列を返す", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllNotes();

      expect(result).toEqual([]);
    });
  });

  describe("findNoteById", () => {
    it("IDでノートを取得する", async () => {
      const mockNote = { id: "note-1", title: "Test Note", content: "Content" };

      const mockLimit = vi.fn().mockResolvedValue([mockNote]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findNoteById("note-1");

      expect(result).toEqual(mockNote);
    });

    it("存在しないIDはnullを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findNoteById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findNotesByIds", () => {
    it("複数IDでノートを取得する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Note 1" },
        { id: "note-2", title: "Note 2" },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findNotesByIds(["note-1", "note-2"]);

      expect(result).toEqual(mockNotes);
    });

    it("空配列を渡すと空配列を返す", async () => {
      const result = await findNotesByIds([]);

      expect(result).toEqual([]);
      expect(db.select).not.toHaveBeenCalled();
    });

    it("存在しないIDは結果に含まれない", async () => {
      const mockNotes = [{ id: "note-1", title: "Note 1" }];

      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findNotesByIds(["note-1", "non-existent"]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("note-1");
    });
  });

  describe("findAllNoteClusterIds", () => {
    it("全ノートのID→clusterIdマッピングを返す", async () => {
      const mockNotes = [
        { id: "note-1", clusterId: 0 },
        { id: "note-2", clusterId: 3 },
        { id: "note-3", clusterId: null },
      ];

      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllNoteClusterIds();

      expect(result).toBeInstanceOf(Map);
      expect(result.get("note-1")).toBe(0);
      expect(result.get("note-2")).toBe(3);
      expect(result.get("note-3")).toBeNull();
      expect(result.size).toBe(3);
    });

    it("ノートがない場合は空Mapを返す", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllNoteClusterIds();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe("updateNotesCategoryInDB", () => {
    it("複数ノートのカテゴリを更新する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      const result = await updateNotesCategoryInDB(["note-1", "note-2"], "技術");

      expect(result).toEqual({ updated: 2 });
      expect(db.update).toHaveBeenCalled();
    });

    it("空配列を渡すと更新をスキップ", async () => {
      const result = await updateNotesCategoryInDB([], "技術");

      expect(result).toEqual({ updated: 0 });
      expect(db.update).not.toHaveBeenCalled();
    });
  });
});
