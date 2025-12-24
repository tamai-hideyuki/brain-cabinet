/**
 * Insight Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック用の関数をvi.hoistedで作成
const { mockGenerateMetaStateLite, mockGenerateMetaStateFull } = vi.hoisted(() => ({
  mockGenerateMetaStateLite: vi.fn(),
  mockGenerateMetaStateFull: vi.fn(),
}));

// モック
vi.mock("../../services/ptm/engine", () => ({
  generateMetaStateLite: mockGenerateMetaStateLite,
  generateMetaStateFull: mockGenerateMetaStateFull,
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { insightRoute } from "./index";

describe("insightRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /lite", () => {
    it("簡潔版メタステートを返す", async () => {
      const mockState = {
        date: "2024-01-15",
        mode: "exploration",
        season: "spring",
        state: "growing",
        coach: "良いペースで成長しています",
      };
      mockGenerateMetaStateLite.mockResolvedValue(mockState);

      const res = await insightRoute.request("/lite");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.date).toBe("2024-01-15");
      expect(json.mode).toBe("exploration");
      expect(json.coach).toBeDefined();
    });

    it("エラー時に500を返す", async () => {
      mockGenerateMetaStateLite.mockRejectedValue(new Error("Engine error"));

      const res = await insightRoute.request("/lite");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to generate insight");
    });
  });

  describe("GET /full", () => {
    it("完全版メタステートを返す", async () => {
      const mockState = {
        date: "2024-01-15",
        mode: "exploration",
        season: "spring",
        state: "growing",
        core: { totalNotes: 100 },
        dynamics: { avgCohesion: 0.85 },
        influence: { totalEdges: 50 },
        coach: "詳細なアドバイス",
      };
      mockGenerateMetaStateFull.mockResolvedValue(mockState);

      const res = await insightRoute.request("/full");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.core).toBeDefined();
      expect(json.dynamics).toBeDefined();
      expect(json.influence).toBeDefined();
    });

    it("エラー時に500を返す", async () => {
      mockGenerateMetaStateFull.mockRejectedValue(new Error("Engine error"));

      const res = await insightRoute.request("/full");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to generate insight");
    });
  });

  describe("GET /coach", () => {
    it("助言のみを返す", async () => {
      const mockState = {
        date: "2024-01-15",
        mode: "integration",
        season: "autumn",
        state: "consolidating",
        coach: "振り返りの時間を設けましょう",
        extra: "除外されるべき",
      };
      mockGenerateMetaStateLite.mockResolvedValue(mockState);

      const res = await insightRoute.request("/coach");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.date).toBe("2024-01-15");
      expect(json.mode).toBe("integration");
      expect(json.season).toBe("autumn");
      expect(json.state).toBe("consolidating");
      expect(json.coach).toBe("振り返りの時間を設けましょう");
      expect(json.extra).toBeUndefined();
    });

    it("エラー時に500を返す", async () => {
      mockGenerateMetaStateLite.mockRejectedValue(new Error("Engine error"));

      const res = await insightRoute.request("/coach");
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Failed to generate advice");
    });
  });
});
