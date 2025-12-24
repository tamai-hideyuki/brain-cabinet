/**
 * PTM Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockGeneratePtmSnapshot,
  mockCapturePtmSnapshot,
  mockGetLatestPtmSnapshot,
  mockGetPtmSnapshotHistory,
  mockGeneratePtmInsight,
  mockComputeCoreMetrics,
  mockComputeInfluenceMetrics,
  mockComputeDynamicsMetrics,
  mockComputeStabilityMetrics,
  mockGenerateMetaStateLite,
} = vi.hoisted(() => ({
  mockGeneratePtmSnapshot: vi.fn(),
  mockCapturePtmSnapshot: vi.fn(),
  mockGetLatestPtmSnapshot: vi.fn(),
  mockGetPtmSnapshotHistory: vi.fn(),
  mockGeneratePtmInsight: vi.fn(),
  mockComputeCoreMetrics: vi.fn(),
  mockComputeInfluenceMetrics: vi.fn(),
  mockComputeDynamicsMetrics: vi.fn(),
  mockComputeStabilityMetrics: vi.fn(),
  mockGenerateMetaStateLite: vi.fn(),
}));

// モック
vi.mock("../../services/ptm/snapshot", () => ({
  generatePtmSnapshot: mockGeneratePtmSnapshot,
  capturePtmSnapshot: mockCapturePtmSnapshot,
  getLatestPtmSnapshot: mockGetLatestPtmSnapshot,
  getPtmSnapshotHistory: mockGetPtmSnapshotHistory,
  generatePtmInsight: mockGeneratePtmInsight,
}));

vi.mock("../../services/ptm/core", () => ({
  computeCoreMetrics: mockComputeCoreMetrics,
}));

vi.mock("../../services/ptm/influence", () => ({
  computeInfluenceMetrics: mockComputeInfluenceMetrics,
}));

vi.mock("../../services/ptm/dynamics", () => ({
  computeDynamicsMetrics: mockComputeDynamicsMetrics,
  computeStabilityMetrics: mockComputeStabilityMetrics,
}));

vi.mock("../../services/ptm/engine", () => ({
  generateMetaStateLite: mockGenerateMetaStateLite,
}));

import { ptmRoute } from "./index";

describe("ptmRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /today", () => {
    it("今日のスナップショットを返す", async () => {
      const mockSnapshot = {
        date: "2024-01-15",
        core: { totalNotes: 100 },
        dynamics: { avgCohesion: 0.85 },
      };
      mockGeneratePtmSnapshot.mockResolvedValue(mockSnapshot);

      const res = await ptmRoute.request("/today");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.date).toBe("2024-01-15");
      expect(json.core.totalNotes).toBe(100);
    });
  });

  describe("GET /history", () => {
    it("履歴を返す", async () => {
      const mockSnapshots = [
        { date: "2024-01-15", core: {} },
        { date: "2024-01-14", core: {} },
      ];
      mockGetPtmSnapshotHistory.mockResolvedValue(mockSnapshots);

      const res = await ptmRoute.request("/history");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.range).toBe("7d");
      expect(json.count).toBe(2);
      expect(json.snapshots).toHaveLength(2);
    });

    it("limitパラメータを処理する", async () => {
      mockGetPtmSnapshotHistory.mockResolvedValue([]);

      await ptmRoute.request("/history?limit=30");

      expect(mockGetPtmSnapshotHistory).toHaveBeenCalledWith(30);
    });
  });

  describe("GET /insight", () => {
    it("インサイトを返す", async () => {
      const mockInsight = {
        date: "2024-01-15",
        mode: "exploration",
        summary: "成長中",
        advice: "良い調子です",
      };
      mockGeneratePtmInsight.mockResolvedValue(mockInsight);

      const res = await ptmRoute.request("/insight");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe("exploration");
      expect(json.advice).toBeDefined();
    });
  });

  describe("POST /capture", () => {
    it("スナップショットをキャプチャ", async () => {
      const mockSnapshot = {
        date: "2024-01-15",
        core: { totalNotes: 100 },
      };
      mockCapturePtmSnapshot.mockResolvedValue(mockSnapshot);

      const res = await ptmRoute.request("/capture", { method: "POST" });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Snapshot captured successfully");
      expect(json.snapshot).toBeDefined();
    });
  });

  describe("GET /core", () => {
    it("コアメトリクスを返す", async () => {
      mockComputeCoreMetrics.mockResolvedValue({
        totalNotes: 100,
        totalClusters: 5,
        avgClusterSize: 20,
        globalCentroid: new Float32Array(1536),
      });

      const res = await ptmRoute.request("/core");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.totalNotes).toBe(100);
      expect(json.globalCentroid).toBe("[1536 dims]");
    });

    it("globalCentroidがnullの場合", async () => {
      mockComputeCoreMetrics.mockResolvedValue({
        totalNotes: 0,
        totalClusters: 0,
        avgClusterSize: 0,
        globalCentroid: null,
      });

      const res = await ptmRoute.request("/core");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.globalCentroid).toBeNull();
    });
  });

  describe("GET /influence", () => {
    it("影響メトリクスを返す", async () => {
      mockComputeInfluenceMetrics.mockResolvedValue({
        totalEdges: 50,
        avgWeight: 0.45,
        topInfluencers: [],
      });

      const res = await ptmRoute.request("/influence");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.totalEdges).toBe(50);
      expect(json.avgWeight).toBe(0.45);
    });
  });

  describe("GET /dynamics", () => {
    it("動態メトリクスを返す", async () => {
      mockComputeDynamicsMetrics.mockResolvedValue({
        avgCohesion: 0.85,
        clusterCount: 5,
      });

      const res = await ptmRoute.request("/dynamics");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.range).toBe("7d");
      expect(json.avgCohesion).toBe(0.85);
    });

    it("rangeパラメータを処理する", async () => {
      mockComputeDynamicsMetrics.mockResolvedValue({});

      await ptmRoute.request("/dynamics?range=30d");

      expect(mockComputeDynamicsMetrics).toHaveBeenCalledWith(30);
    });
  });

  describe("GET /stability", () => {
    it("安定性メトリクスを返す", async () => {
      mockComputeStabilityMetrics.mockResolvedValue({
        stabilityScore: 0.9,
        volatility: 0.1,
      });

      const res = await ptmRoute.request("/stability");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.stabilityScore).toBe(0.9);
      expect(json.date).toBeDefined();
    });

    it("dateパラメータを処理する", async () => {
      mockComputeStabilityMetrics.mockResolvedValue({});

      await ptmRoute.request("/stability?date=2024-01-10");

      expect(mockComputeStabilityMetrics).toHaveBeenCalledWith("2024-01-10");
    });
  });

  describe("GET /summary", () => {
    it("サマリーを返す", async () => {
      const mockMetaState = {
        date: "2024-01-15",
        mode: "exploration",
        season: "spring",
        state: "growing",
        coach: "良いペースです",
      };
      mockGenerateMetaStateLite.mockResolvedValue(mockMetaState);

      const res = await ptmRoute.request("/summary");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.mode).toBe("exploration");
      expect(json.coach).toBe("良いペースです");
    });
  });
});
