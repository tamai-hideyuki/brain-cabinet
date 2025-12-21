/**
 * Relation Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRelation,
  createRelations,
  deleteRelationsBySourceNote,
  deleteAllRelationsForNote,
  findRelationsBySourceNote,
  findRelationsByTargetNote,
  findAllRelationsForNote,
  deleteAllRelationsForNoteRaw,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockWhere = vi.fn().mockResolvedValue([]);
  const mockOrderBy = vi.fn().mockReturnValue({ where: mockWhere });
  const mockFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
    orderBy: mockOrderBy,
  });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
  const mockDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    },
  };
});

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "mock-uuid-123"),
}));

import { db } from "../../db/client";

describe("relationRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRelation", () => {
    it("Relationを作成する", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      await createRelation({
        sourceNoteId: "source-1",
        targetNoteId: "target-1",
        relationType: "similar",
        score: 0.85,
      });

      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "mock-uuid-123",
          sourceNoteId: "source-1",
          targetNoteId: "target-1",
          relationType: "similar",
          score: "0.85",
        })
      );
    });

    it("scoreを文字列に変換する", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      await createRelation({
        sourceNoteId: "source-1",
        targetNoteId: "target-1",
        relationType: "related",
        score: 0.9,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          score: "0.9",
        })
      );
    });
  });

  describe("createRelations", () => {
    it("複数のRelationを一括作成する", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const relations = [
        {
          sourceNoteId: "source-1",
          targetNoteId: "target-1",
          relationType: "similar" as const,
          score: 0.85,
        },
        {
          sourceNoteId: "source-1",
          targetNoteId: "target-2",
          relationType: "related" as const,
          score: 0.75,
        },
      ];

      await createRelations(relations);

      expect(db.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            sourceNoteId: "source-1",
            targetNoteId: "target-1",
          }),
          expect.objectContaining({
            sourceNoteId: "source-1",
            targetNoteId: "target-2",
          }),
        ])
      );
    });

    it("空配列を渡すと処理をスキップする", async () => {
      await createRelations([]);

      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("deleteRelationsBySourceNote", () => {
    it("sourceNoteIdで削除する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as any);

      await deleteRelationsBySourceNote("note-1");

      expect(db.delete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe("deleteAllRelationsForNote", () => {
    it("source/target両方でRelationを削除する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.delete).mockReturnValue({ where: mockWhere } as any);

      await deleteAllRelationsForNote("note-1");

      expect(db.delete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe("findRelationsBySourceNote", () => {
    it("sourceNoteIdでRelationを検索する", async () => {
      const mockRelations = [
        {
          id: "rel-1",
          sourceNoteId: "note-1",
          targetNoteId: "note-2",
          relationType: "similar",
          score: "0.85",
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockRelations);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findRelationsBySourceNote("note-1");

      expect(result).toEqual(mockRelations);
      expect(db.select).toHaveBeenCalled();
    });

    it("Relationがない場合は空配列を返す", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findRelationsBySourceNote("note-1");

      expect(result).toEqual([]);
    });
  });

  describe("findRelationsByTargetNote", () => {
    it("targetNoteIdでRelationを検索する", async () => {
      const mockRelations = [
        {
          id: "rel-1",
          sourceNoteId: "note-2",
          targetNoteId: "note-1",
          relationType: "similar",
          score: "0.85",
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockRelations);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findRelationsByTargetNote("note-1");

      expect(result).toEqual(mockRelations);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("findAllRelationsForNote", () => {
    it("source/target両方のRelationを検索する", async () => {
      const mockRelations = [
        {
          id: "rel-1",
          sourceNoteId: "note-1",
          targetNoteId: "note-2",
          relationType: "similar",
          score: "0.85",
        },
        {
          id: "rel-2",
          sourceNoteId: "note-3",
          targetNoteId: "note-1",
          relationType: "related",
          score: "0.75",
        },
      ];

      const mockOrderBy = vi.fn().mockResolvedValue(mockRelations);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllRelationsForNote("note-1");

      expect(result).toEqual(mockRelations);
    });

    it("createdAtの降順でソートする", async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await findAllRelationsForNote("note-1");

      expect(mockOrderBy).toHaveBeenCalled();
    });
  });

  describe("deleteAllRelationsForNoteRaw", () => {
    it("トランザクション内でRelationを削除する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
      const mockTx = { delete: mockDelete };

      await deleteAllRelationsForNoteRaw(mockTx as any, "note-1");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });
});
