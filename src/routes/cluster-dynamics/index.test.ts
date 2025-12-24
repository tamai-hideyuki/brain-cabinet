/**
 * Cluster Dynamics Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockGetClusterDynamicsSummary,
  mockGetClusterDynamics,
  mockGetClusterDynamicsTimeline,
  mockCaptureClusterDynamics,
} = vi.hoisted(() => ({
  mockGetClusterDynamicsSummary: vi.fn(),
  mockGetClusterDynamics: vi.fn(),
  mockGetClusterDynamicsTimeline: vi.fn(),
  mockCaptureClusterDynamics: vi.fn(),
}));

// サービスのモック
vi.mock("../../services/cluster/clusterDynamicsService", () => ({
  getClusterDynamicsSummary: mockGetClusterDynamicsSummary,
  getClusterDynamics: mockGetClusterDynamics,
  getClusterDynamicsTimeline: mockGetClusterDynamicsTimeline,
  captureClusterDynamics: mockCaptureClusterDynamics,
}));

import { clusterDynamicsRoute } from "./index";

describe("clusterDynamicsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /summary", () => {
    it("サマリーを返す", async () => {
      const mockSummary = {
        clusterCount: 5,
        totalNotes: 100,
        avgCohesion: 0.85,
        maxCohesion: { clusterId: 1, cohesion: 0.95 },
        minCohesion: { clusterId: 3, cohesion: 0.65 },
        mostUnstable: { clusterId: 2, stabilityScore: 0.15 },
      };
      mockGetClusterDynamicsSummary.mockResolvedValue(mockSummary);

      const res = await clusterDynamicsRoute.request("/summary");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clusterCount).toBe(5);
      expect(json.totalNotes).toBe(100);
      expect(json.avgCohesion).toBe(0.85);
    });

    it("dateクエリパラメータを渡す", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 0,
        totalNotes: 0,
        avgCohesion: 0,
        maxCohesion: null,
        minCohesion: null,
        mostUnstable: null,
      });

      await clusterDynamicsRoute.request("/summary?date=2024-01-15");

      expect(mockGetClusterDynamicsSummary).toHaveBeenCalledWith("2024-01-15");
    });

    it("dateが未指定の場合は今日の日付を使用", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 0,
        totalNotes: 0,
        avgCohesion: 0,
        maxCohesion: null,
        minCohesion: null,
        mostUnstable: null,
      });

      await clusterDynamicsRoute.request("/summary");

      const today = new Date().toISOString().split("T")[0];
      expect(mockGetClusterDynamicsSummary).toHaveBeenCalledWith(today);
    });
  });

  describe("GET /snapshot", () => {
    it("スナップショットを返す（centroidは除外）", async () => {
      const mockDynamics = [
        {
          clusterId: 1,
          cohesion: 0.9,
          noteCount: 20,
          interactions: { "2": 0.5 },
          stabilityScore: 0.1,
          centroid: new Float32Array([0.1, 0.2, 0.3]), // 除外されるべき
        },
        {
          clusterId: 2,
          cohesion: 0.8,
          noteCount: 15,
          interactions: { "1": 0.5 },
          stabilityScore: 0.2,
          centroid: new Float32Array([0.4, 0.5, 0.6]),
        },
      ];
      mockGetClusterDynamics.mockResolvedValue(mockDynamics);

      const res = await clusterDynamicsRoute.request("/snapshot?date=2024-01-15");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.date).toBe("2024-01-15");
      expect(json.clusters).toHaveLength(2);
      expect(json.clusters[0].centroid).toBeUndefined();
      expect(json.clusters[0].clusterId).toBe(1);
      expect(json.clusters[0].cohesion).toBe(0.9);
    });

    it("空の配列を返す", async () => {
      mockGetClusterDynamics.mockResolvedValue([]);

      const res = await clusterDynamicsRoute.request("/snapshot");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clusters).toHaveLength(0);
    });
  });

  describe("GET /timeline/:clusterId", () => {
    it("クラスタの時系列データを返す", async () => {
      const mockTimeline = [
        { date: "2024-01-14", cohesion: 0.85, noteCount: 18 },
        { date: "2024-01-15", cohesion: 0.9, noteCount: 20 },
      ];
      mockGetClusterDynamicsTimeline.mockResolvedValue(mockTimeline);

      const res = await clusterDynamicsRoute.request("/timeline/1?range=7d");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clusterId).toBe(1);
      expect(json.range).toBe("7d");
      expect(json.data).toHaveLength(2);
      expect(mockGetClusterDynamicsTimeline).toHaveBeenCalledWith(1, 7);
    });

    it("rangeが未指定の場合は30dを使用", async () => {
      mockGetClusterDynamicsTimeline.mockResolvedValue([]);

      const res = await clusterDynamicsRoute.request("/timeline/5");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.range).toBe("30d");
      expect(mockGetClusterDynamicsTimeline).toHaveBeenCalledWith(5, 30);
    });

    it("不正なrange形式の場合は30dをデフォルトに", async () => {
      mockGetClusterDynamicsTimeline.mockResolvedValue([]);

      await clusterDynamicsRoute.request("/timeline/1?range=invalid");

      expect(mockGetClusterDynamicsTimeline).toHaveBeenCalledWith(1, 30);
    });
  });

  describe("POST /capture", () => {
    it("スナップショットをキャプチャして結果を返す", async () => {
      const mockSnapshots = [
        { clusterId: 1, cohesion: 0.9, noteCount: 20, stabilityScore: 0.1 },
        { clusterId: 2, cohesion: 0.8, noteCount: 15, stabilityScore: 0.2 },
      ];
      mockCaptureClusterDynamics.mockResolvedValue(mockSnapshots);

      const res = await clusterDynamicsRoute.request("/capture", {
        method: "POST",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.captured).toBe(2);
      expect(json.clusters).toHaveLength(2);
      expect(json.date).toBeDefined();
    });

    it("空のキャプチャ結果を返す", async () => {
      mockCaptureClusterDynamics.mockResolvedValue([]);

      const res = await clusterDynamicsRoute.request("/capture", {
        method: "POST",
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.captured).toBe(0);
      expect(json.clusters).toHaveLength(0);
    });
  });

  describe("GET /matrix", () => {
    it("クラスタ間距離マトリクスを返す", async () => {
      const mockDynamics = [
        { clusterId: 1, cohesion: 0.9, noteCount: 20, interactions: { "2": 0.7 } },
        { clusterId: 2, cohesion: 0.8, noteCount: 15, interactions: { "1": 0.7 } },
      ];
      mockGetClusterDynamics.mockResolvedValue(mockDynamics);

      const res = await clusterDynamicsRoute.request("/matrix?date=2024-01-15");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.date).toBe("2024-01-15");
      expect(json.clusterIds).toEqual([1, 2]);
      expect(json.matrix["1"]["2"]).toBe(0.7);
      expect(json.matrix["1"]["1"]).toBe(1.0); // 自己相関
      expect(json.matrix["2"]["2"]).toBe(1.0);
    });

    it("空のマトリクスを返す", async () => {
      mockGetClusterDynamics.mockResolvedValue([]);

      const res = await clusterDynamicsRoute.request("/matrix");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.clusterIds).toEqual([]);
      expect(json.matrix).toEqual({});
    });
  });

  describe("GET /insight", () => {
    it("インサイトを返す", async () => {
      const mockSummary = {
        clusterCount: 3,
        totalNotes: 50,
        avgCohesion: 0.85,
        maxCohesion: { clusterId: 1, cohesion: 0.95 },
        minCohesion: { clusterId: 3, cohesion: 0.7 },
        mostUnstable: { clusterId: 2, stabilityScore: 0.15 },
      };
      const mockDynamics = [
        { clusterId: 1, cohesion: 0.95, noteCount: 20, interactions: { "2": 0.5 } },
        { clusterId: 2, cohesion: 0.8, noteCount: 15, interactions: { "1": 0.5 } },
        { clusterId: 3, cohesion: 0.7, noteCount: 15, interactions: {} },
      ];
      mockGetClusterDynamicsSummary.mockResolvedValue(mockSummary);
      mockGetClusterDynamics.mockResolvedValue(mockDynamics);

      const res = await clusterDynamicsRoute.request("/insight?date=2024-01-15");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.date).toBe("2024-01-15");
      expect(json.summary.clusterCount).toBe(3);
      expect(json.summary.totalNotes).toBe(50);
      expect(json.highlights.mostCohesive.clusterId).toBe(1);
      expect(json.highlights.leastCohesive.clusterId).toBe(3);
      expect(json.insight).toBeDefined();
      expect(typeof json.insight).toBe("string");
    });

    it("クラスタがない場合のインサイト", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 0,
        totalNotes: 0,
        avgCohesion: 0,
        maxCohesion: null,
        minCohesion: null,
        mostUnstable: null,
      });
      mockGetClusterDynamics.mockResolvedValue([]);

      const res = await clusterDynamicsRoute.request("/insight");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.insight).toBe("クラスタ動態データがありません。");
    });

    it("高凝集度の場合のインサイト", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 2,
        totalNotes: 30,
        avgCohesion: 0.9,
        maxCohesion: { clusterId: 1, cohesion: 0.95 },
        minCohesion: { clusterId: 2, cohesion: 0.85 },
        mostUnstable: null,
      });
      mockGetClusterDynamics.mockResolvedValue([
        { clusterId: 1, cohesion: 0.95, noteCount: 15, interactions: {} },
        { clusterId: 2, cohesion: 0.85, noteCount: 15, interactions: {} },
      ]);

      const res = await clusterDynamicsRoute.request("/insight");
      const json = await res.json();

      expect(json.insight).toContain("凝集度が高く");
    });

    it("低凝集度の場合のインサイト", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 2,
        totalNotes: 30,
        avgCohesion: 0.6,
        maxCohesion: { clusterId: 1, cohesion: 0.7 },
        minCohesion: { clusterId: 2, cohesion: 0.5 },
        mostUnstable: null,
      });
      mockGetClusterDynamics.mockResolvedValue([
        { clusterId: 1, cohesion: 0.7, noteCount: 15, interactions: {} },
        { clusterId: 2, cohesion: 0.5, noteCount: 15, interactions: {} },
      ]);

      const res = await clusterDynamicsRoute.request("/insight");
      const json = await res.json();

      expect(json.insight).toContain("凝集度が低め");
    });

    it("不安定なクラスタがある場合のインサイト", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 2,
        totalNotes: 30,
        avgCohesion: 0.75,
        maxCohesion: { clusterId: 1, cohesion: 0.8 },
        minCohesion: { clusterId: 2, cohesion: 0.7 },
        mostUnstable: { clusterId: 2, stabilityScore: 0.2 },
      });
      mockGetClusterDynamics.mockResolvedValue([
        { clusterId: 1, cohesion: 0.8, noteCount: 15, interactions: {} },
        { clusterId: 2, cohesion: 0.7, noteCount: 15, interactions: {} },
      ]);

      const res = await clusterDynamicsRoute.request("/insight");
      const json = await res.json();

      expect(json.insight).toContain("クラスタ 2 が最も変化");
    });

    it("密接に関連するクラスタがある場合のインサイト", async () => {
      mockGetClusterDynamicsSummary.mockResolvedValue({
        clusterCount: 2,
        totalNotes: 30,
        avgCohesion: 0.75,
        maxCohesion: { clusterId: 1, cohesion: 0.8 },
        minCohesion: { clusterId: 2, cohesion: 0.7 },
        mostUnstable: null,
      });
      mockGetClusterDynamics.mockResolvedValue([
        { clusterId: 1, cohesion: 0.8, noteCount: 15, interactions: { "2": 0.85 } },
        { clusterId: 2, cohesion: 0.7, noteCount: 15, interactions: { "1": 0.85 } },
      ]);

      const res = await clusterDynamicsRoute.request("/insight");
      const json = await res.json();

      expect(json.insight).toContain("密接に関連");
    });
  });
});
