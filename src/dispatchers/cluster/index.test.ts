/**
 * Cluster Dispatcher のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/clusterRepo", () => ({
  findAllClusters: vi.fn(),
  findClusterById: vi.fn(),
  findNotesByClusterId: vi.fn(),
}));

vi.mock("../../repositories/embeddingRepo", () => ({
  getEmbedding: vi.fn(),
}));

vi.mock("../../services/embeddingService", () => ({
  cosineSimilarity: vi.fn(),
}));

vi.mock("../../services/cluster/identity", () => ({
  getAllClusterIdentities: vi.fn(),
  getClusterIdentity: vi.fn(),
  formatForGpt: vi.fn(),
}));

vi.mock("../../services/jobs/job-queue", () => ({
  enqueueJob: vi.fn(),
}));

import { clusterDispatcher } from "./index";
import * as clusterRepo from "../../repositories/clusterRepo";
import * as embeddingRepo from "../../repositories/embeddingRepo";
import * as embeddingService from "../../services/embeddingService";
import * as identityService from "../../services/cluster/identity";
import { enqueueJob } from "../../services/jobs/job-queue";

describe("clusterDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("全クラスタを取得しcentroidを除外して返す", async () => {
      const mockClusters = [
        { id: 1, name: "Cluster 1", centroid: [0.1, 0.2, 0.3] },
        { id: 2, name: "Cluster 2", centroid: [0.4, 0.5, 0.6] },
      ];
      vi.mocked(clusterRepo.findAllClusters).mockResolvedValue(mockClusters as any);

      const result = await clusterDispatcher.list();

      expect(clusterRepo.findAllClusters).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual([
        { id: 1, name: "Cluster 1" },
        { id: 2, name: "Cluster 2" },
      ]);
    });

    it("空の配列を返す場合", async () => {
      vi.mocked(clusterRepo.findAllClusters).mockResolvedValue([]);

      const result = await clusterDispatcher.list();

      expect(result).toStrictEqual([]);
    });
  });

  describe("get", () => {
    describe("バリデーション", () => {
      it("idがない場合エラーを投げる", async () => {
        await expect(clusterDispatcher.get({})).rejects.toThrow("id is required");
      });

      it("idがundefinedの場合エラーを投げる", async () => {
        await expect(clusterDispatcher.get(undefined)).rejects.toThrow("id is required");
      });
    });

    describe("正常系", () => {
      it("クラスタとそのノートを返す", async () => {
        const mockCluster = { id: 1, name: "Cluster 1", centroid: [0.1, 0.2] };
        const mockNotes = [
          { id: "note-1", title: "Note 1" },
          { id: "note-2", title: "Note 2" },
        ];
        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(mockCluster as any);
        vi.mocked(clusterRepo.findNotesByClusterId).mockResolvedValue(mockNotes as any);

        const result = await clusterDispatcher.get({ id: 1 });

        expect(clusterRepo.findClusterById).toHaveBeenCalledWith(1);
        expect(clusterRepo.findNotesByClusterId).toHaveBeenCalledWith(1);
        expect(result).toStrictEqual({
          ...mockCluster,
          notes: mockNotes,
        });
      });

      it("クラスタが存在しない場合エラーを投げる", async () => {
        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(null);

        await expect(clusterDispatcher.get({ id: 999 })).rejects.toThrow(
          "Cluster 999 not found"
        );
      });
    });
  });

  describe("map", () => {
    const mockIdentities = [
      {
        clusterId: 1,
        identity: {
          name: null,
          summary: null,
          keywords: ["test"],
          representatives: [],
          drift: { contribution: 0.1, trend: "flat", recentDriftSum: 0.5 },
          influence: { outDegree: 0.2, inDegree: 0.3, hubness: 0.4, authority: 0.6 },
          cohesion: 0.8,
          noteCount: 10,
        },
      },
    ];

    it("デフォルトでfull形式を返す", async () => {
      vi.mocked(identityService.getAllClusterIdentities).mockResolvedValue(
        mockIdentities as any
      );

      const result = await clusterDispatcher.map(undefined);

      expect(identityService.getAllClusterIdentities).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(mockIdentities);
    });

    it("format=fullでfull形式を返す", async () => {
      vi.mocked(identityService.getAllClusterIdentities).mockResolvedValue(
        mockIdentities as any
      );

      const result = await clusterDispatcher.map({ format: "full" });

      expect(result).toStrictEqual(mockIdentities);
    });

    it("format=gptでGPT向けフォーマットを返す", async () => {
      const mockGptFormat = {
        task: "cluster_identity",
        clusterId: 1,
        identityData: { keywords: ["test"] },
      };
      vi.mocked(identityService.getAllClusterIdentities).mockResolvedValue(
        mockIdentities as any
      );
      vi.mocked(identityService.formatForGpt).mockReturnValue(mockGptFormat as any);

      const result = await clusterDispatcher.map({ format: "gpt" });

      expect(identityService.formatForGpt).toHaveBeenCalledTimes(1);
      expect(vi.mocked(identityService.formatForGpt).mock.calls[0][0]).toStrictEqual(
        mockIdentities[0]
      );
      expect(result).toStrictEqual([mockGptFormat]);
    });

    it("不正なformatの場合エラーを投げる", async () => {
      await expect(clusterDispatcher.map({ format: "invalid" as any })).rejects.toThrow();
    });
  });

  describe("identity", () => {
    describe("バリデーション", () => {
      it("idがない場合エラーを投げる", async () => {
        await expect(clusterDispatcher.identity({})).rejects.toThrow("id is required");
      });
    });

    describe("正常系", () => {
      it("クラスタのidentityを返す", async () => {
        const mockIdentity = {
          clusterId: 1,
          identity: {
            name: null,
            summary: null,
            keywords: ["test"],
            representatives: [],
            drift: { contribution: 0.1, trend: "flat", recentDriftSum: 0.5 },
            influence: { outDegree: 0.2, inDegree: 0.3, hubness: 0.4, authority: 0.6 },
            cohesion: 0.8,
            noteCount: 10,
          },
        };
        vi.mocked(identityService.getClusterIdentity).mockResolvedValue(mockIdentity as any);

        const result = await clusterDispatcher.identity({ id: 1 });

        expect(identityService.getClusterIdentity).toHaveBeenCalledWith(1);
        expect(result).toStrictEqual(mockIdentity);
      });
    });
  });

  describe("representatives", () => {
    describe("バリデーション", () => {
      it("idがない場合エラーを投げる", async () => {
        await expect(clusterDispatcher.representatives({})).rejects.toThrow(
          "id is required"
        );
      });
    });

    describe("正常系", () => {
      it("centroidがない場合は先頭N件を返す", async () => {
        const mockCluster = { id: 1, name: "Cluster 1", centroid: null };
        const mockNotes = [
          { id: "note-1", title: "Note 1" },
          { id: "note-2", title: "Note 2" },
          { id: "note-3", title: "Note 3" },
        ];
        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(mockCluster as any);
        vi.mocked(clusterRepo.findNotesByClusterId).mockResolvedValue(mockNotes as any);

        const result = await clusterDispatcher.representatives({ id: 1, limit: 2 });

        expect(result).toStrictEqual([
          { id: "note-1", title: "Note 1" },
          { id: "note-2", title: "Note 2" },
        ]);
      });

      it("centroidがある場合は類似度順で返す", async () => {
        const mockCentroid = [0.5, 0.5];
        const mockCluster = { id: 1, name: "Cluster 1", centroid: mockCentroid };
        const mockNotes = [
          { id: "note-1", title: "Note 1" },
          { id: "note-2", title: "Note 2" },
        ];
        const mockEmbedding1 = [0.1, 0.1];
        const mockEmbedding2 = [0.4, 0.4];

        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(mockCluster as any);
        vi.mocked(clusterRepo.findNotesByClusterId).mockResolvedValue(mockNotes as any);
        vi.mocked(embeddingRepo.getEmbedding)
          .mockResolvedValueOnce(mockEmbedding1 as any)
          .mockResolvedValueOnce(mockEmbedding2 as any);
        vi.mocked(embeddingService.cosineSimilarity)
          .mockReturnValueOnce(0.3)
          .mockReturnValueOnce(0.9);

        const result = await clusterDispatcher.representatives({ id: 1 });

        // note-2の方が類似度が高いので先に来る
        expect(result[0].id).toBe("note-2");
        expect(result[0]).toHaveProperty("centroidSimilarity", 0.9);
        expect(result[1].id).toBe("note-1");
        expect(result[1]).toHaveProperty("centroidSimilarity", 0.3);
      });

      it("embeddingがないノートは類似度0として扱う", async () => {
        const mockCentroid = [0.5, 0.5];
        const mockCluster = { id: 1, name: "Cluster 1", centroid: mockCentroid };
        const mockNotes = [{ id: "note-1", title: "Note 1" }];

        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(mockCluster as any);
        vi.mocked(clusterRepo.findNotesByClusterId).mockResolvedValue(mockNotes as any);
        vi.mocked(embeddingRepo.getEmbedding).mockResolvedValue(null);

        const result = await clusterDispatcher.representatives({ id: 1 });

        expect(result[0]).toHaveProperty("centroidSimilarity", 0);
      });

      it("デフォルトでlimit=5を使用する", async () => {
        const mockCluster = { id: 1, name: "Cluster 1", centroid: null };
        const mockNotes = Array.from({ length: 10 }, (_, i) => ({
          id: `note-${i}`,
          title: `Note ${i}`,
        }));
        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(mockCluster as any);
        vi.mocked(clusterRepo.findNotesByClusterId).mockResolvedValue(mockNotes as any);

        const result = await clusterDispatcher.representatives({ id: 1 });

        expect(result).toHaveLength(5);
      });

      it("クラスタが存在しない場合エラーを投げる", async () => {
        vi.mocked(clusterRepo.findClusterById).mockResolvedValue(null);

        await expect(clusterDispatcher.representatives({ id: 999 })).rejects.toThrow(
          "Cluster 999 not found"
        );
      });
    });
  });

  describe("rebuild", () => {
    it("デフォルトパラメータでジョブをエンキューする", async () => {
      vi.mocked(enqueueJob).mockResolvedValue("job-123");

      const result = await clusterDispatcher.rebuild(undefined);

      expect(enqueueJob).toHaveBeenCalledWith("CLUSTER_REBUILD", {
        k: 8,
        regenerateEmbeddings: false,
      });
      expect(result).toStrictEqual({
        message: "Cluster rebuild job enqueued",
        params: {
          k: 8,
          regenerateEmbeddings: false,
        },
      });
    });

    it("指定されたkでジョブをエンキューする", async () => {
      vi.mocked(enqueueJob).mockResolvedValue("job-123");

      const result = await clusterDispatcher.rebuild({ k: 15 });

      expect(enqueueJob).toHaveBeenCalledWith("CLUSTER_REBUILD", {
        k: 15,
        regenerateEmbeddings: false,
      });
      expect(result.params.k).toBe(15);
    });

    it("kの範囲外の値は範囲内に収められる", async () => {
      vi.mocked(enqueueJob).mockResolvedValue("job-123");

      // k=1は最小値2に収められる
      await clusterDispatcher.rebuild({ k: 1 });
      expect(enqueueJob).toHaveBeenCalledWith("CLUSTER_REBUILD", {
        k: 2,
        regenerateEmbeddings: false,
      });

      vi.clearAllMocks();

      // k=100は最大値50に収められる
      await clusterDispatcher.rebuild({ k: 100 });
      expect(enqueueJob).toHaveBeenCalledWith("CLUSTER_REBUILD", {
        k: 50,
        regenerateEmbeddings: false,
      });
    });

    it("regenerateEmbeddings=trueでジョブをエンキューする", async () => {
      vi.mocked(enqueueJob).mockResolvedValue("job-123");

      const result = await clusterDispatcher.rebuild({ regenerateEmbeddings: true });

      expect(enqueueJob).toHaveBeenCalledWith("CLUSTER_REBUILD", {
        k: 8,
        regenerateEmbeddings: true,
      });
      expect(result.params.regenerateEmbeddings).toBe(true);
    });
  });
});
