/**
 * Cluster Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveCluster,
  saveClusters,
  deleteAllClusters,
  findAllClusters,
  findClusterById,
  findNotesByClusterId,
  updateNoteClusterId,
  updateAllNoteClusterIds,
  resetAllNoteClusterIds,
  deleteClusterHistoryByNoteIdRaw,
  arrayToBase64,
  base64ToArray,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockWhere = vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue([]),
  });
  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
  });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockRun = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    db: {
      select: mockSelect,
      run: mockRun,
      delete: mockDelete,
      update: mockUpdate,
    },
  };
});

import { db } from "../../db/client";

describe("clusterRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("arrayToBase64", () => {
    it("number配列をBase64に変換する", () => {
      const arr = [1.0, 2.0, 3.0];
      const result = arrayToBase64(arr);

      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("空配列を変換する", () => {
      const result = arrayToBase64([]);

      expect(result).toBe("");
    });
  });

  describe("base64ToArray", () => {
    it("Base64をnumber配列に変換する", () => {
      const original = [1.0, 2.0, 3.0];
      const base64 = arrayToBase64(original);
      const result = base64ToArray(base64);

      expect(result).toEqual(original);
    });

    it("空文字列を変換する", () => {
      const result = base64ToArray("");

      expect(result).toEqual([]);
    });
  });

  describe("saveCluster", () => {
    it("クラスタを保存する", async () => {
      await saveCluster({
        id: 1,
        centroid: [0.1, 0.2, 0.3],
        size: 5,
        sampleNoteId: "note-1",
      });

      expect(db.run).toHaveBeenCalled();
    });

    it("sampleNoteIdがnullでも保存できる", async () => {
      await saveCluster({
        id: 1,
        centroid: [0.1, 0.2],
        size: 3,
        sampleNoteId: null,
      });

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("saveClusters", () => {
    it("複数クラスタを一括保存する", async () => {
      const clusters = [
        { id: 1, centroid: [0.1], size: 2, sampleNoteId: "note-1" },
        { id: 2, centroid: [0.2], size: 3, sampleNoteId: "note-2" },
      ];

      await saveClusters(clusters);

      expect(db.run).toHaveBeenCalledTimes(2);
    });

    it("空配列を渡すと何も保存しない", async () => {
      await saveClusters([]);

      expect(db.run).not.toHaveBeenCalled();
    });
  });

  describe("deleteAllClusters", () => {
    it("全クラスタを削除する", async () => {
      await deleteAllClusters();

      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("findAllClusters", () => {
    it("全クラスタを取得する", async () => {
      const mockClusters = [
        { id: 1, centroid: arrayToBase64([1.0, 2.0]), size: 5, sampleNoteId: "note-1" },
        { id: 2, centroid: arrayToBase64([3.0, 4.0]), size: 3, sampleNoteId: "note-2" },
      ];
      const mockFrom = vi.fn().mockResolvedValue(mockClusters);
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllClusters();

      expect(result).toHaveLength(2);
      expect(result[0].centroid).toEqual([1.0, 2.0]);
      expect(result[1].centroid).toEqual([3.0, 4.0]);
    });

    it("クラスタがない場合は空配列を返す", async () => {
      const mockFrom = vi.fn().mockResolvedValue([]);
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllClusters();

      expect(result).toEqual([]);
    });

    it("centroidがnullの場合はnullを返す", async () => {
      const mockClusters = [{ id: 1, centroid: null, size: 0, sampleNoteId: null }];
      const mockFrom = vi.fn().mockResolvedValue(mockClusters);
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findAllClusters();

      expect(result[0].centroid).toBeNull();
    });
  });

  describe("findClusterById", () => {
    it("IDでクラスタを取得する", async () => {
      const mockCluster = {
        id: 1,
        centroid: arrayToBase64([1.0, 2.0]),
        size: 5,
        sampleNoteId: "note-1",
      };
      const mockLimit = vi.fn().mockResolvedValue([mockCluster]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findClusterById(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.centroid).toEqual([1.0, 2.0]);
    });

    it("存在しないIDはnullを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findClusterById(999);

      expect(result).toBeNull();
    });
  });

  describe("findNotesByClusterId", () => {
    it("クラスタIDでノートを取得する", async () => {
      const mockNotes = [
        { id: "note-1", title: "Note 1", clusterId: 1 },
        { id: "note-2", title: "Note 2", clusterId: 1 },
      ];
      const mockWhere = vi.fn().mockResolvedValue(mockNotes);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findNotesByClusterId(1);

      expect(result).toEqual(mockNotes);
    });

    it("ノートがない場合は空配列を返す", async () => {
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await findNotesByClusterId(999);

      expect(result).toEqual([]);
    });
  });

  describe("updateNoteClusterId", () => {
    it("ノートのclusterIdを更新する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await updateNoteClusterId("note-1", 2);

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ clusterId: 2 });
    });
  });

  describe("updateAllNoteClusterIds", () => {
    it("複数ノートのclusterIdを一括更新する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      const assignments = [
        { noteId: "note-1", clusterId: 1 },
        { noteId: "note-2", clusterId: 2 },
        { noteId: "note-3", clusterId: 1 },
      ];

      await updateAllNoteClusterIds(assignments);

      expect(db.update).toHaveBeenCalledTimes(3);
    });

    it("空配列を渡すと何も更新しない", async () => {
      await updateAllNoteClusterIds([]);

      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("resetAllNoteClusterIds", () => {
    it("全ノートのclusterIdをリセットする", async () => {
      await resetAllNoteClusterIds();

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("deleteClusterHistoryByNoteIdRaw", () => {
    it("トランザクション内でクラスタ履歴を削除する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });
      const mockTx = { delete: mockDelete };

      await deleteClusterHistoryByNoteIdRaw(mockTx as any, "note-1");

      expect(mockDelete).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });
});
