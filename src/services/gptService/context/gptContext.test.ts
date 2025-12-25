/**
 * v5.13 GPT Context Service Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック設定
vi.mock("../../analytics", () => ({
  getSummaryStats: vi.fn().mockResolvedValue({
    totalNotes: 50,
    notesLast30Days: 10,
    changesLast30Days: 25,
    avgSemanticDiffLast30Days: 0.15,
  }),
}));

vi.mock("../../analytics/multiTimescale", () => ({
  analyzeGlobalTimescales: vi.fn().mockResolvedValue({
    analysisDate: "2025-12-26",
    clusterCount: 5,
    activeClusterCount: 4,
    globalTrends: {
      weekly: { direction: "rising", velocity: 0.6, confidence: 0.8, dataPoints: 10 },
      monthly: { direction: "stable", velocity: 0.2, confidence: 0.7, dataPoints: 8 },
      quarterly: { direction: "rising", velocity: 0.4, confidence: 0.6, dataPoints: 12 },
    },
    topGrowingClusters: [{ clusterId: 1, velocity: 0.5 }],
    topDecliningClusters: [{ clusterId: 3, velocity: -0.3 }],
    seasonalPatterns: [],
    phaseTransitions: [],
  }),
}));

vi.mock("../../influence/causalInference", () => ({
  getGlobalCausalSummary: vi.fn().mockResolvedValue({
    totalCausalPairs: 15,
    strongCausalRelations: 8,
    avgCausalStrength: 0.45,
    topCausalInfluencers: [],
    pivotNotes: [{ noteId: "note-1", title: "重要なノート", pivotProbability: 0.8 }],
  }),
}));

vi.mock("../../drift/driftDirection", () => ({
  analyzeDriftFlows: vi.fn().mockResolvedValue({
    analysisDate: "2025-12-26",
    totalDrifts: 20,
    dominantFlow: { fromClusterId: 1, toClusterId: 2, count: 5, avgDriftScore: 0.3, avgAlignment: 0.4 },
    insight: "クラスター間の移動が活発です",
    flows: [],
    clusterSummaries: [
      { clusterId: 1, inflow: 3, outflow: 5, netFlow: -2, avgIncomingAlignment: 0.3, avgOutgoingAlignment: 0.4 },
      { clusterId: 2, inflow: 5, outflow: 2, netFlow: 3, avgIncomingAlignment: 0.4, avgOutgoingAlignment: 0.3 },
    ],
  }),
}));

vi.mock("../../influence/influenceService", () => ({
  getInfluenceStats: vi.fn().mockResolvedValue({
    totalEdges: 100,
    avgWeight: 0.35,
    maxWeight: 0.9,
    topInfluencedNotes: [],
    topInfluencers: [],
  }),
}));

vi.mock("../../cluster/metrics", () => ({
  getGlobalQualityMetrics: vi.fn().mockResolvedValue({
    overallSilhouette: 0.45,
    daviesBouldinIndex: 1.2,
    clusterCount: 5,
    totalNotes: 50,
    optimalKEstimate: 5,
    qualityAssessment: "good",
    clusterMetrics: [
      {
        clusterId: 1,
        qualityGrade: "A",
        cohesion: 0.8,
        silhouette: { avgSilhouette: 0.5, minSilhouette: 0.2, maxSilhouette: 0.8, noteCount: 10 },
        subClusterAnalysis: { hasSubClusters: false, separationScore: 0.1, subClusters: [] },
      },
    ],
  }),
}));

vi.mock("../../../repositories/clusterRepo", () => ({
  findAllClusters: vi.fn().mockResolvedValue([
    { id: 1, size: 10 },
    { id: 2, size: 15 },
    { id: 3, size: 8 },
  ]),
}));

vi.mock("../../cache", () => ({
  getOrCompute: vi.fn().mockImplementation(async (_key, _type, fn) => fn()),
  generateCacheKey: vi.fn().mockReturnValue("test-cache-key"),
}));

import { generateGptContext, getGptContext } from "./gptContext";
import type { GptContext, GptContextOptions } from "./gptContext";

describe("GPT Context Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateGptContext", () => {
    it("should generate valid context with all fields", async () => {
      const context = await generateGptContext();

      expect(context).toHaveProperty("generatedAt");
      expect(context).toHaveProperty("summary");
      expect(context).toHaveProperty("priorities");
      expect(context).toHaveProperty("recentActivity");
      expect(context).toHaveProperty("recommendations");
      expect(context).toHaveProperty("detailEndpoints");
    });

    it("should include summary text", async () => {
      const context = await generateGptContext();

      expect(context.summary).toContain("50個のノート");
      expect(context.summary).toContain("3個のクラスター");
    });

    it("should include recent activity stats", async () => {
      const context = await generateGptContext();

      expect(context.recentActivity.notesCreated).toBe(10);
      expect(context.recentActivity.notesUpdated).toBe(25);
      expect(context.recentActivity.avgSemanticDiff).toBe(0.15);
    });

    it("should detect drift trend from timescale analysis", async () => {
      const context = await generateGptContext();

      // velocity > 0.3 and direction === "growth" → expansion
      expect(context.recentActivity.driftTrend).toBe("expansion");
    });

    it("should include priorities with importance levels", async () => {
      const context = await generateGptContext();

      expect(context.priorities.length).toBeGreaterThan(0);
      expect(context.priorities[0]).toHaveProperty("type");
      expect(context.priorities[0]).toHaveProperty("message");
      expect(context.priorities[0]).toHaveProperty("importance");
    });

    it("should include recommendations", async () => {
      const context = await generateGptContext();

      expect(context.recommendations.length).toBeGreaterThan(0);
      expect(context.recommendations[0]).toHaveProperty("message");
      expect(context.recommendations[0]).toHaveProperty("actionType");
    });

    it("should include detail endpoints", async () => {
      const context = await generateGptContext();

      expect(context.detailEndpoints.timescale).toBe("/api/analytics/timescale");
      expect(context.detailEndpoints.causal).toBe("/api/influence/causal/summary");
      expect(context.detailEndpoints.driftFlows).toBe("/api/drift/flows");
      expect(context.detailEndpoints.clusterQuality).toBe("/api/clusters/quality");
    });

    it("should respect maxPriorities option", async () => {
      const context = await generateGptContext({ maxPriorities: 2 });

      expect(context.priorities.length).toBeLessThanOrEqual(2);
    });

    it("should respect maxRecommendations option", async () => {
      const context = await generateGptContext({ maxRecommendations: 1 });

      expect(context.recommendations.length).toBeLessThanOrEqual(1);
    });

    it("should filter by focus=warnings", async () => {
      const context = await generateGptContext({ focus: "warnings" });

      for (const priority of context.priorities) {
        expect(priority.type).toBe("warning");
      }
    });

    it("should filter by focus=trends", async () => {
      const context = await generateGptContext({ focus: "trends" });

      for (const priority of context.priorities) {
        expect(priority.type).toBe("insight");
      }
    });
  });

  describe("getGptContext", () => {
    it("should use cache service", async () => {
      const { getOrCompute, generateCacheKey } = await import("../../cache");

      await getGptContext({ focus: "overview" });

      expect(generateCacheKey).toHaveBeenCalledWith("gpt_context", { focus: "overview" });
      expect(getOrCompute).toHaveBeenCalled();
    });
  });

  describe("priority extraction", () => {
    it("should detect growth trend from timescale", async () => {
      const context = await generateGptContext();

      const growthInsight = context.priorities.find(
        (p) => p.message.includes("成長") && p.message.includes("傾向")
      );
      expect(growthInsight).toBeDefined();
      expect(growthInsight?.importance).toBe("high");
    });

    it("should detect pivot notes from causal analysis", async () => {
      const context = await generateGptContext();

      const pivotInsight = context.priorities.find(
        (p) => p.message.includes("重要なノート")
      );
      expect(pivotInsight).toBeDefined();
    });

    it("should detect declining clusters", async () => {
      const context = await generateGptContext();

      const declineWarning = context.priorities.find(
        (p) => p.message.includes("クラスター3") && p.message.includes("低下")
      );
      expect(declineWarning).toBeDefined();
      expect(declineWarning?.type).toBe("warning");
    });
  });

  describe("recommendation generation", () => {
    it("should recommend exploring growing clusters", async () => {
      const context = await generateGptContext();

      const exploreRec = context.recommendations.find(
        (r) => r.actionType === "explore"
      );
      expect(exploreRec).toBeDefined();
      expect(exploreRec?.message).toContain("クラスター1");
    });

    it("should recommend reviewing declining clusters", async () => {
      const context = await generateGptContext();

      const reviewRec = context.recommendations.find(
        (r) => r.actionType === "review" && r.message.includes("クラスター3")
      );
      expect(reviewRec).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle partial failures gracefully", async () => {
      // 一つのサービスがエラーを返しても動作することを確認
      const { analyzeGlobalTimescales } = await import("../../analytics/multiTimescale");
      vi.mocked(analyzeGlobalTimescales).mockRejectedValueOnce(new Error("API error"));

      const context = await generateGptContext();

      // エラーがあっても基本構造は返る
      expect(context).toHaveProperty("summary");
      expect(context).toHaveProperty("priorities");
    });
  });
});
