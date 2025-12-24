/**
 * Clusters Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockFindAllClusters,
  mockFindClusterById,
  mockFindNotesByClusterId,
  mockEnqueueJob,
  mockGetClusterIdentity,
  mockGetAllClusterIdentities,
  mockDbAll,
} = vi.hoisted(() => ({
  mockFindAllClusters: vi.fn(),
  mockFindClusterById: vi.fn(),
  mockFindNotesByClusterId: vi.fn(),
  mockEnqueueJob: vi.fn(),
  mockGetClusterIdentity: vi.fn(),
  mockGetAllClusterIdentities: vi.fn(),
  mockDbAll: vi.fn(),
}));

// モック
vi.mock("../../repositories/clusterRepo", () => ({
  findAllClusters: mockFindAllClusters,
  findClusterById: mockFindClusterById,
  findNotesByClusterId: mockFindNotesByClusterId,
}));

vi.mock("../../services/jobs/job-queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

vi.mock("../../services/cluster/identity", () => ({
  getClusterIdentity: mockGetClusterIdentity,
  getAllClusterIdentities: mockGetAllClusterIdentities,
  formatForGpt: vi.fn((identity) => ({
    clusterId: identity.clusterId,
    label: identity.label,
  })),
  GPT_IDENTITY_PROMPT: "Test prompt",
}));

vi.mock("../../db/client", () => ({
  db: {
    all: mockDbAll,
  },
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { clustersRoute } from "./index";

describe("clustersRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("全クラスタ一覧を返す", async () => {
      const mockClusters = [
        { id: 1, size: 10, sampleNoteId: "note-1", createdAt: 1000, updatedAt: 2000 },
        { id: 2, size: 5, sampleNoteId: "note-2", createdAt: 1100, updatedAt: 2100 },
      ];
      mockFindAllClusters.mockResolvedValue(mockClusters);

      const res = await clustersRoute.request("/");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.count).toBe(2);
      expect(json.clusters).toHaveLength(2);
      expect(json.clusters[0].id).toBe(1);
      expect(json.clusters[0].size).toBe(10);
    });

    it("空の配列を返す", async () => {
      mockFindAllClusters.mockResolvedValue([]);

      const res = await clustersRoute.request("/");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.count).toBe(0);
      expect(json.clusters).toHaveLength(0);
    });
  });

  describe("GET /map", () => {
    it("全クラスタのidentity一覧を返す", async () => {
      const mockIdentities = [
        { clusterId: 1, label: "AI関連", size: 10 },
        { clusterId: 2, label: "Web開発", size: 5 },
      ];
      mockGetAllClusterIdentities.mockResolvedValue(mockIdentities);

      const res = await clustersRoute.request("/map");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.count).toBe(2);
      expect(json.clusters).toEqual(mockIdentities);
    });
  });

  describe("GET /map/gpt", () => {
    it("GPT用フォーマットで返す", async () => {
      const mockIdentities = [
        { clusterId: 1, label: "AI関連", size: 10 },
      ];
      mockGetAllClusterIdentities.mockResolvedValue(mockIdentities);

      const res = await clustersRoute.request("/map/gpt");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.prompt).toBe("Test prompt");
      expect(json.count).toBe(1);
      expect(json.clusters).toBeDefined();
    });
  });

  describe("GET /:id", () => {
    it("クラスタ詳細を返す", async () => {
      mockFindClusterById.mockResolvedValue({
        id: 1,
        size: 10,
        sampleNoteId: "note-1",
        createdAt: 1000,
        updatedAt: 2000,
      });
      mockFindNotesByClusterId.mockResolvedValue([
        { id: "note-1", title: "Test Note", category: "memo", tags: '["tag1"]' },
      ]);

      const res = await clustersRoute.request("/1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.cluster.id).toBe(1);
      expect(json.notes).toHaveLength(1);
      expect(json.notes[0].tags).toEqual(["tag1"]);
    });

    it("無効なIDで400を返す", async () => {
      const res = await clustersRoute.request("/invalid");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid cluster ID");
    });

    it("存在しないクラスタで404を返す", async () => {
      mockFindClusterById.mockResolvedValue(null);

      const res = await clustersRoute.request("/999");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("Cluster not found");
    });
  });

  describe("GET /:id/identity", () => {
    it("クラスタのidentityを返す", async () => {
      const mockIdentity = {
        clusterId: 1,
        label: "AI関連",
        size: 10,
        cohesion: 0.85,
      };
      mockGetClusterIdentity.mockResolvedValue(mockIdentity);

      const res = await clustersRoute.request("/1/identity");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clusterId).toBe(1);
      expect(json.label).toBe("AI関連");
    });

    it("無効なIDで400を返す", async () => {
      const res = await clustersRoute.request("/invalid/identity");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid cluster ID");
    });

    it("identityが見つからない場合404を返す", async () => {
      mockGetClusterIdentity.mockResolvedValue(null);

      const res = await clustersRoute.request("/999/identity");
      const json = await res.json();

      expect(res.status).toBe(404);
    });
  });

  describe("GET /:id/representatives", () => {
    it("無効なIDで400を返す", async () => {
      const res = await clustersRoute.request("/invalid/representatives");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Invalid cluster ID");
    });

    it("無効なtopパラメータで400を返す", async () => {
      const res = await clustersRoute.request("/1/representatives?top=100");
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("top must be between 1 and 20");
    });

    it("centroidがない場合404を返す", async () => {
      mockDbAll.mockResolvedValue([]);

      const res = await clustersRoute.request("/1/representatives");
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.error).toBe("No centroid available for this cluster");
    });
  });

  describe("POST /rebuild", () => {
    it("クラスタ再構築ジョブをキューに追加", async () => {
      const res = await clustersRoute.request("/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: 10, regenerateEmbeddings: true }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Cluster rebuild job enqueued");
      expect(json.k).toBe(10);
      expect(json.regenerateEmbeddings).toBe(true);
      expect(mockEnqueueJob).toHaveBeenCalledWith("CLUSTER_REBUILD", {
        k: 10,
        regenerateEmbeddings: true,
      });
    });

    it("デフォルト値で再構築", async () => {
      const res = await clustersRoute.request("/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.k).toBe(8);
      expect(json.regenerateEmbeddings).toBe(true);
    });

    it("無効なk値で400を返す", async () => {
      const res = await clustersRoute.request("/rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ k: 100 }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("k must be a number between 2 and 50");
    });
  });
});
