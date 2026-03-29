/**
 * サーバーエントリーポイント
 *
 * 環境変数を読み込み、サーバーを起動する
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app";
import { logger } from "./shared/utils/logger";
import { enqueueJob } from "./modules/jobs/services/job-queue";

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);

  // サーバー起動時に削除済みノートのクリーンアップを実行
  enqueueJob("CLEANUP_DELETED_NOTES").catch((err) => {
    logger.error({ err }, "Failed to enqueue cleanup job");
  });
});
