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
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  const banner = `
  Brain Cabinet v${version}
  ─────────────────────────────
    API  → http://localhost:${info.port}
    DB   → data.db (WAL)
    Log  → ${process.env.LOG_LEVEL || "info"}
  ─────────────────────────────`;
  console.log(banner);

  // サーバー起動時に削除済みノートのクリーンアップを実行
  enqueueJob("CLEANUP_DELETED_NOTES").catch((err) => {
    logger.error({ err }, "Failed to enqueue cleanup job");
  });
});
