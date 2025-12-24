/**
 * Influence Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const {
  mockGetInfluencersOf,
  mockGetInfluencedBy,
  mockGetInfluenceStats,
  mockGetAllInfluenceEdges,
  mockFindNoteById,
} = vi.hoisted(() => ({
  mockGetInfluencersOf: vi.fn(),
  mockGetInfluencedBy: vi.fn(),
  mockGetInfluenceStats: vi.fn(),
  mockGetAllInfluenceEdges: vi.fn(),
  mockFindNoteById: vi.fn(),
}));

// モック
vi.mock("../../services/influence/influenceService", () => ({
  getInfluencersOf: mockGetInfluencersOf,
  getInfluencedBy: mockGetInfluencedBy,
  getInfluenceStats: mockGetInfluenceStats,
  getAllInfluenceEdges: mockGetAllInfluenceEdges,
}));

vi.mock("../../repositories/notesRepo", () => ({
  findNoteById: mockFindNoteById,
}));

import { influenceRoute } from "./index";

describe("influenceRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /stats", () => {
    it("全体統計を返す", async () => {
      mockGetInfluenceStats.mockResolvedValue({
        totalEdges: 100,
        avgWeight: 0.5,
        maxWeight: 0.9,
        topInfluencedNotes: [{ noteId: "note-1", edgeCount: 5, totalInfluence: 2.5 }],
        topInfluencers: [{ noteId: "note-2", edgeCount: 10, totalInfluence: 5.0 }],
      });

      const res = await influenceRoute.request("/stats");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.totalEdges).toBe(100);
      expect(json.avgWeight).toBe(0.5);
      expect(json.topInfluencedNotes).toBeDefined();
      expect(json.topInfluencers).toBeDefined();
    });
  });

  describe("GET /note/:noteId/influencers", () => {
    it("影響を与えているノート一覧を返す", async () => {
      mockGetInfluencersOf.mockResolvedValue([
        { sourceNoteId: "note-2", targetNoteId: "note-1", weight: 0.8 },
      ]);
      mockFindNoteById.mockResolvedValue({
        id: "note-2",
        title: "Source Note",
        clusterId: 1,
      });

      const res = await influenceRoute.request("/note/note-1/influencers");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.noteId).toBe("note-1");
      expect(json.influencers).toHaveLength(1);
      expect(json.influencers[0].sourceNote.title).toBe("Source Note");
    });

    it("limitパラメータを処理する", async () => {
      mockGetInfluencersOf.mockResolvedValue([]);

      await influenceRoute.request("/note/note-1/influencers?limit=5");

      expect(mockGetInfluencersOf).toHaveBeenCalledWith("note-1", 5);
    });
  });

  describe("GET /note/:noteId/influenced", () => {
    it("影響を受けているノート一覧を返す", async () => {
      mockGetInfluencedBy.mockResolvedValue([
        { sourceNoteId: "note-1", targetNoteId: "note-2", weight: 0.7 },
      ]);
      mockFindNoteById.mockResolvedValue({
        id: "note-2",
        title: "Target Note",
        clusterId: 2,
      });

      const res = await influenceRoute.request("/note/note-1/influenced");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.noteId).toBe("note-1");
      expect(json.influenced).toHaveLength(1);
      expect(json.influenced[0].targetNote.title).toBe("Target Note");
    });
  });

  describe("GET /note/:noteId", () => {
    it("双方向の影響関係を返す", async () => {
      mockGetInfluencersOf.mockResolvedValue([
        { sourceNoteId: "note-2", targetNoteId: "note-1", weight: 0.8 },
      ]);
      mockGetInfluencedBy.mockResolvedValue([
        { sourceNoteId: "note-1", targetNoteId: "note-3", weight: 0.6 },
      ]);
      mockFindNoteById.mockImplementation(async (id: string) => ({
        id,
        title: `Note ${id}`,
        clusterId: 1,
      }));

      const res = await influenceRoute.request("/note/note-1");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.note).toBeDefined();
      expect(json.summary.incomingEdges).toBe(1);
      expect(json.summary.outgoingEdges).toBe(1);
      expect(json.influencers).toHaveLength(1);
      expect(json.influenced).toHaveLength(1);
    });
  });

  describe("GET /summary", () => {
    it("GPT向けサマリーを返す", async () => {
      mockGetInfluenceStats.mockResolvedValue({
        totalEdges: 50,
        avgWeight: 0.45,
        maxWeight: 0.95,
        topInfluencedNotes: [{ noteId: "note-1", edgeCount: 5, totalInfluence: 2.5 }],
        topInfluencers: [{ noteId: "note-2", edgeCount: 8, totalInfluence: 4.0 }],
      });
      mockFindNoteById.mockImplementation(async (id: string) => ({
        id,
        title: `Note ${id}`,
        clusterId: 1,
      }));

      const res = await influenceRoute.request("/summary");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.overview.totalEdges).toBe(50);
      expect(json.topInfluenced).toBeDefined();
      expect(json.topInfluencers).toBeDefined();
      expect(json.insight).toBeDefined();
    });

    it("エッジがない場合のインサイト", async () => {
      mockGetInfluenceStats.mockResolvedValue({
        totalEdges: 0,
        avgWeight: 0,
        maxWeight: 0,
        topInfluencedNotes: [],
        topInfluencers: [],
      });

      const res = await influenceRoute.request("/summary");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.insight).toContain("まだ影響関係が構築されていません");
    });
  });

  describe("GET /graph", () => {
    it("グラフデータを返す", async () => {
      mockGetAllInfluenceEdges.mockResolvedValue([
        { sourceNoteId: "note-1", targetNoteId: "note-2", weight: 0.7 },
      ]);
      mockFindNoteById.mockImplementation(async (id: string) => ({
        id,
        title: `Note ${id}`,
        clusterId: 1,
      }));

      const res = await influenceRoute.request("/graph");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.nodes).toHaveLength(2);
      expect(json.edges).toHaveLength(1);
      expect(json.stats.nodeCount).toBe(2);
      expect(json.stats.edgeCount).toBe(1);
    });

    it("limitパラメータを処理する", async () => {
      mockGetAllInfluenceEdges.mockResolvedValue([]);

      await influenceRoute.request("/graph?limit=50");

      expect(mockGetAllInfluenceEdges).toHaveBeenCalledWith(50);
    });
  });
});
