/**
 * グローバルエラーハンドラ
 *
 * 未処理エラーをキャッチしてログ出力・500レスポンスを返す
 */
import type { ErrorHandler } from "hono";
import { logger } from "../utils/logger";

export const errorHandler: ErrorHandler = (err, c) => {
  logger.error(
    {
      err,
      method: c.req.method,
      path: c.req.path,
    },
    "Unhandled error"
  );
  return c.json({ error: "Internal Server Error" }, 500);
};
