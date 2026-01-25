/**
 * Health Service のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { performHealthCheck, type HealthCheckResult } from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([{ count: 1 }]),
    }),
  });
  return {
    db: {
      select: mockSelect,
    },
  };
});

// Ollamaヘルスチェックをモック
vi.mock("../inference/llmInference/ollamaHealth", () => ({
  checkOllamaHealth: vi.fn().mockResolvedValue({
    available: true,
    modelLoaded: true,
    model: "qwen2.5:3b",
    message: "Ollama準備完了 (qwen2.5:3b)",
  }),
}));

import { db } from "../../db/client";
import { checkOllamaHealth } from "../inference/llmInference/ollamaHealth";

describe("healthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performHealthCheck", () => {
    it("正常時にhealthyステータスを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(result.status).toBe("healthy");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("uptime");
      expect(result).toHaveProperty("checks");
      expect(result).toHaveProperty("gptSummary");
    });

    it("タイムスタンプがISO 8601形式で返される", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("uptimeが数値で返される", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(typeof result.uptime).toBe("number");
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it("checksにdatabase, storage, ollamaが含まれる", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 10 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(result.checks).toHaveProperty("database");
      expect(result.checks).toHaveProperty("storage");
      expect(result.checks).toHaveProperty("ollama");
      expect(result.checks.database).toHaveProperty("status");
      expect(result.checks.database).toHaveProperty("message");
      expect(result.checks.storage).toHaveProperty("status");
      expect(result.checks.storage).toHaveProperty("notesCount");
      expect(result.checks.ollama).toHaveProperty("available");
      expect(result.checks.ollama).toHaveProperty("modelLoaded");
      expect(result.checks.ollama).toHaveProperty("message");
    });

    it("Ollama障害時にdegradedステータスを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      // Ollamaを利用不可に設定
      vi.mocked(checkOllamaHealth).mockResolvedValueOnce({
        available: false,
        modelLoaded: false,
        model: "qwen2.5:3b",
        message: "Ollamaサーバーに接続できません",
      });

      const result = await performHealthCheck();

      expect(result.status).toBe("degraded");
      expect(result.checks.ollama.available).toBe(false);
    });

    it("gptSummaryが文字列で返される", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(typeof result.gptSummary).toBe("string");
      expect(result.gptSummary.length).toBeGreaterThan(0);
    });

    it("データベースエラー時にunhealthyステータスを返す", async () => {
      const mockLimit = vi.fn().mockRejectedValue(new Error("DB connection failed"));
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(result.status).toBe("unhealthy");
      expect(result.checks.database.status).toBe("unhealthy");
    });

    it("正常時にdatabase.latencyが含まれる", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ count: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ limit: mockLimit });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await performHealthCheck();

      expect(result.checks.database).toHaveProperty("latency");
      expect(typeof result.checks.database.latency).toBe("number");
    });
  });
});
