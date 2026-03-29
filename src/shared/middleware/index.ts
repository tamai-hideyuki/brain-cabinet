/**
 * ミドルウェア一括適用
 *
 * Honoアプリに必要なミドルウェアをまとめて適用する
 */
import type { Hono } from "hono";
import { requestLogger } from "./request-logger";
import { errorHandler } from "./error-handler";
import { authMiddleware } from "./auth";

export function applyMiddleware(app: Hono): void {
  // リクエストログ（全リクエスト）
  app.use("*", requestLogger);

  // グローバルエラーハンドラ
  app.onError(errorHandler);

  // API認証（/api/* のみ）
  app.use("/api/*", authMiddleware);
}
