/**
 * Decision Service のテスト
 *
 * v7.5: searchDecisionsWithContext のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockSearchNotesHybrid,
  mockGetLatestInference,
  mockClassify,
  mockGetSearchPriority,
  mockGetClusterIdentity,
} = vi.hoisted(() => ({
  mockSearchNotesHybrid: vi.fn(),
  mockGetLatestInference: vi.fn(),
  mockClassify: vi.fn(),
  mockGetSearchPriority: vi.fn(),
  mockGetClusterIdentity: vi.fn(),
}));

vi.mock("../searchService", () => ({
  searchNotesHybrid: mockSearchNotesHybrid,
}));

vi.mock("../inference", () => ({
  getLatestInference: mockGetLatestInference,
  classify: mockClassify,
  getSearchPriority: mockGetSearchPriority,
}));

vi.mock("../cluster/identity", () => ({
  getClusterIdentity: mockGetClusterIdentity,
}));

vi.mock("../counterevidence", () => ({
  getCounterevidences: vi.fn().mockResolvedValue([]),
  getCounterevidencelSummary: vi.fn().mockResolvedValue({
    hasAny: false,
    count: 0,
    dominant: null,
    summary: [],
  }),
}));

vi.mock("../../db/client", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

import {
  searchDecisions,
  searchDecisionsWithContext,
  type ClusterContext,
} from "./index";

describe("Decision Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchDecisions", () => {
    it("空の結果を返す（ハイブリッド検索が空の場合）", async () => {
      mockSearchNotesHybrid.mockResolvedValue([]);

      const result = await searchDecisions("test query");

      expect(result).toEqual([]);
      expect(mockSearchNotesHybrid).toHaveBeenCalledWith("test query", {
        keywordWeight: 0.5,
        semanticWeight: 0.5,
      });
    });

    it("decision タイプのみをフィルタリングする", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content 1", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
        { id: "note-2", title: "Note 2", content: "Content 2", createdAt: 2000, hybridScore: 0.7, clusterId: 2 },
      ]);

      mockGetLatestInference
        .mockResolvedValueOnce({
          type: "decision",
          confidence: 0.8,
          confidenceDetail: { structural: 0.8, experiential: 0.7, temporal: 0.9 },
          decayProfile: "stable",
          intent: "architecture",
          reasoning: "Test reasoning 1",
        })
        .mockResolvedValueOnce({
          type: "learning", // Not a decision
          confidence: 0.7,
        });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      const result = await searchDecisions("test query");

      expect(result).toHaveLength(1);
      expect(result[0].noteId).toBe("note-1");
      expect(result[0].clusterId).toBe(1);
    });

    it("minConfidence 未満の判断を除外する", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content", createdAt: 1000, hybridScore: 0.8 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.3, // Below default 0.4
        decayProfile: "stable",
        intent: "design",
        reasoning: "Low confidence",
      });

      const result = await searchDecisions("test query");

      expect(result).toHaveLength(0);
    });

    it("intent でフィルタリングする", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content", createdAt: 1000, hybridScore: 0.8 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "design",
        reasoning: "Design reasoning",
      });

      const result = await searchDecisions("test query", { intent: "architecture" });

      expect(result).toHaveLength(0);
    });
  });

  describe("searchDecisionsWithContext (v7.5)", () => {
    it("クラスタコンテキストを含む結果を返す", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content 1", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        confidenceDetail: { structural: 0.8, experiential: 0.7, temporal: 0.9 },
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test reasoning",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      mockGetClusterIdentity.mockResolvedValue({
        clusterId: 1,
        identity: {
          keywords: ["keyword1", "keyword2"],
          noteCount: 10,
          cohesion: 0.85,
          drift: { contribution: 0.4, trend: "rising" },
          influence: { hubness: 0.6, authority: 0.4 },
        },
      });

      const result = await searchDecisionsWithContext("test query");

      expect(result.results).toHaveLength(1);
      expect(result.results[0].clusterContext).toBeDefined();
      expect(result.results[0].clusterContext?.clusterId).toBe(1);
      expect(result.results[0].clusterContext?.role).toBe("driver"); // contribution > 0.3
      expect(result.results[0].clusterContext?.keywords).toContain("keyword1");
    });

    it("クラスタサマリーを正しく生成する", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content 1", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
        { id: "note-2", title: "Note 2", content: "Content 2", createdAt: 2000, hybridScore: 0.7, clusterId: 1 },
        { id: "note-3", title: "Note 3", content: "Content 3", createdAt: 3000, hybridScore: 0.6, clusterId: 2 },
      ]);

      mockGetLatestInference
        .mockResolvedValueOnce({
          type: "decision",
          confidence: 0.8,
          decayProfile: "stable",
          intent: "architecture",
          reasoning: "Reasoning 1",
        })
        .mockResolvedValueOnce({
          type: "decision",
          confidence: 0.6,
          decayProfile: "stable",
          intent: "design",
          reasoning: "Reasoning 2",
        })
        .mockResolvedValueOnce({
          type: "decision",
          confidence: 0.9,
          decayProfile: "stable",
          intent: "architecture",
          reasoning: "Reasoning 3",
        });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      mockGetClusterIdentity
        .mockResolvedValueOnce({
          clusterId: 1,
          identity: {
            keywords: ["cluster1"],
            noteCount: 5,
            cohesion: 0.8,
            drift: { contribution: 0.2, trend: "flat" },
            influence: { hubness: 0.5, authority: 0.5 },
          },
        })
        .mockResolvedValueOnce({
          clusterId: 1,
          identity: {
            keywords: ["cluster1"],
            noteCount: 5,
            cohesion: 0.8,
            drift: { contribution: 0.2, trend: "flat" },
            influence: { hubness: 0.5, authority: 0.5 },
          },
        })
        .mockResolvedValueOnce({
          clusterId: 2,
          identity: {
            keywords: ["cluster2"],
            noteCount: 3,
            cohesion: 0.7,
            drift: { contribution: 0.1, trend: "falling" },
            influence: { hubness: 0.3, authority: 0.7 },
          },
        });

      const result = await searchDecisionsWithContext("test query");

      expect(result.clusterSummary).toHaveLength(2);
      // クラスタ1が2件、クラスタ2が1件
      const cluster1Summary = result.clusterSummary.find((c) => c.clusterId === 1);
      const cluster2Summary = result.clusterSummary.find((c) => c.clusterId === 2);
      expect(cluster1Summary?.decisionCount).toBe(2);
      expect(cluster2Summary?.decisionCount).toBe(1);
      // 平均 confidence が計算されていること
      expect(cluster1Summary?.avgConfidence).toBeGreaterThan(0);
      expect(cluster2Summary?.avgConfidence).toBeGreaterThan(0);
    });

    it("クラスタが見つからない場合は clusterContext が null になる", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content 1", createdAt: 1000, hybridScore: 0.8, clusterId: null },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      const result = await searchDecisionsWithContext("test query");

      expect(result.results).toHaveLength(1);
      expect(result.results[0].clusterContext).toBeNull();
    });

    it("includeClusterContext=false でコンテキストをスキップ", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content 1", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      const result = await searchDecisionsWithContext("test query", {
        includeClusterContext: false,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].clusterContext).toBeNull();
      expect(mockGetClusterIdentity).not.toHaveBeenCalled();
    });
  });

  describe("ClusterRole 判定", () => {
    it("contribution > 0.3 で driver を返す", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      mockGetClusterIdentity.mockResolvedValue({
        clusterId: 1,
        identity: {
          keywords: ["test"],
          noteCount: 10,
          cohesion: 0.5,
          drift: { contribution: 0.4, trend: "rising" },
          influence: { hubness: 0.2, authority: 0.3 },
        },
      });

      const result = await searchDecisionsWithContext("test query");

      expect(result.results[0].clusterContext?.role).toBe("driver");
    });

    it("cohesion > 0.8 かつ contribution < 0.1 かつ hubness > 0.5 で stabilizer を返す", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      mockGetClusterIdentity.mockResolvedValue({
        clusterId: 1,
        identity: {
          keywords: ["test"],
          noteCount: 10,
          cohesion: 0.85,
          drift: { contribution: 0.05, trend: "flat" },
          influence: { hubness: 0.6, authority: 0.4 },
        },
      });

      const result = await searchDecisionsWithContext("test query");

      expect(result.results[0].clusterContext?.role).toBe("stabilizer");
    });

    it("hubness > 0.3 かつ authority > 0.3 で bridge を返す", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      mockGetClusterIdentity.mockResolvedValue({
        clusterId: 1,
        identity: {
          keywords: ["test"],
          noteCount: 10,
          cohesion: 0.6,
          drift: { contribution: 0.2, trend: "flat" },
          influence: { hubness: 0.4, authority: 0.4 },
        },
      });

      const result = await searchDecisionsWithContext("test query");

      expect(result.results[0].clusterContext?.role).toBe("bridge");
    });

    it("条件に合致しない場合は isolated を返す", async () => {
      mockSearchNotesHybrid.mockResolvedValue([
        { id: "note-1", title: "Note 1", content: "Content", createdAt: 1000, hybridScore: 0.8, clusterId: 1 },
      ]);

      mockGetLatestInference.mockResolvedValue({
        type: "decision",
        confidence: 0.8,
        decayProfile: "stable",
        intent: "architecture",
        reasoning: "Test",
      });

      mockClassify.mockReturnValue({ primaryType: "decision", reliability: "high" });
      mockGetSearchPriority.mockReturnValue(0.9);

      mockGetClusterIdentity.mockResolvedValue({
        clusterId: 1,
        identity: {
          keywords: ["test"],
          noteCount: 10,
          cohesion: 0.5,
          drift: { contribution: 0.1, trend: "flat" },
          influence: { hubness: 0.2, authority: 0.2 },
        },
      });

      const result = await searchDecisionsWithContext("test query");

      expect(result.results[0].clusterContext?.role).toBe("isolated");
    });
  });
});
