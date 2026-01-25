/**
 * グローバルエラーハンドラ
 *
 * 未処理エラーをキャッチし、構造化されたエラーレスポンスを返す
 * - AppErrorはそのまま構造化レスポンスに変換
 * - その他のエラーはAppErrorにラップして処理
 */
import type { ErrorHandler } from "hono";
import { logger } from "../utils/logger";
import { isAppError, toAppError } from "../utils/errors";

export const errorHandler: ErrorHandler = (err, c) => {
  // AppErrorに変換（既にAppErrorならそのまま、それ以外はラップ）
  const appError = isAppError(err) ? err : toAppError(err);

  // 構造化されたログ出力
  logger.error(
    {
      code: appError.code,
      message: appError.message,
      field: appError.field,
      details: appError.details,
      statusCode: appError.statusCode,
      method: c.req.method,
      path: c.req.path,
      cause: err instanceof Error ? err.stack : undefined,
    },
    "API Error"
  );

  // 構造化されたエラーレスポンス
  return c.json(appError.toJSON(), appError.statusCode);
};
