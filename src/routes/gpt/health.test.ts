/**
 * GPT Health Route のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// モック
vi.mock("../../services/health", () => ({
  performHealthCheck: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { healthRoute } from "./health";
import { performHealthCheck } from "../../services/health";

describe("healthRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /health", () => {
    it("正常時にhealthyステータスを返す", async () => {
      const mockHealth = {
        status: "healthy",
        timestamp: "2024-01-01T00:00:00.000Z",
        uptime: 3600,
        checks: {
          database: { status: "healthy", message: "OK" },
          storage: { status: "healthy", notesCount: 100, message: "100件のノート" },
        },
        gptSummary: "✅ 正常稼働中",
      };
      vi.mocked(performHealthCheck).mockResolvedValue(mockHealth as any);

      const res = await healthRoute.request("/health");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("healthy");
      expect(json.gptSummary).toBeDefined();
    });

    it("unhealthy時に503を返す", async () => {
      const mockHealth = {
        status: "unhealthy",
        timestamp: "2024-01-01T00:00:00.000Z",
        uptime: 3600,
        checks: {
          database: { status: "unhealthy", message: "DB Error" },
          storage: { status: "healthy", notesCount: 0, message: "0件のノート" },
        },
        gptSummary: "❌ 障害発生中",
      };
      vi.mocked(performHealthCheck).mockResolvedValue(mockHealth as any);

      const res = await healthRoute.request("/health");
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe("unhealthy");
    });

    it("degraded時に503を返す", async () => {
      const mockHealth = {
        status: "degraded",
        timestamp: "2024-01-01T00:00:00.000Z",
        uptime: 3600,
        checks: {
          database: { status: "healthy", message: "OK" },
          storage: { status: "degraded", notesCount: 0, message: "警告" },
        },
        gptSummary: "⚠️ 一部機能に問題あり",
      };
      vi.mocked(performHealthCheck).mockResolvedValue(mockHealth as any);

      const res = await healthRoute.request("/health");
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe("degraded");
    });

    it("エラー発生時に503とエラー情報を返す", async () => {
      vi.mocked(performHealthCheck).mockRejectedValue(new Error("Health check failed"));

      const res = await healthRoute.request("/health");
      const json = await res.json();

      expect(res.status).toBe(503);
      expect(json.status).toBe("unhealthy");
      expect(json.error).toBe("Health check failed");
      expect(json.gptSummary).toContain("エラー");
    });

    it("エラー時にtimestampを返す", async () => {
      vi.mocked(performHealthCheck).mockRejectedValue(new Error("Test error"));

      const res = await healthRoute.request("/health");
      const json = await res.json();

      expect(json.timestamp).toBeDefined();
      expect(typeof json.timestamp).toBe("string");
    });

    it("performHealthCheckを呼び出す", async () => {
      const mockHealth = {
        status: "healthy",
        timestamp: "2024-01-01T00:00:00.000Z",
        uptime: 3600,
        checks: {},
        gptSummary: "OK",
      };
      vi.mocked(performHealthCheck).mockResolvedValue(mockHealth as any);

      await healthRoute.request("/health");

      expect(performHealthCheck).toHaveBeenCalledTimes(1);
    });
  });
});
