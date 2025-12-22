import { Hono } from "hono";
import { performHealthCheck } from "../../services/health";
import { logger } from "../../utils/logger";

export const healthRoute = new Hono();

/**
 * GPT向けヘルスチェック
 * GET /api/gpt/health
 *
 * サーバーの状態をGPTが理解しやすい形式で返す
 */
healthRoute.get("/health", async (c) => {
  try {
    const health = await performHealthCheck();

    // ステータスに応じてHTTPステータスコードを変える
    const httpStatus = health.status === "healthy" ? 200 : 503;

    return c.json(health, httpStatus);
  } catch (e) {
    logger.error({ err: e }, "Health check failed");
    return c.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: (e as Error).message,
        gptSummary: "❌ ヘルスチェックの実行中にエラーが発生しました。サーバーに問題がある可能性があります。",
      },
      503
    );
  }
});
