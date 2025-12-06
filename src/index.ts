import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { notesRoute } from "./routes/notes/index";
import { searchRoute } from "./routes/search/index";
import { gptRoute } from "./routes/gpt/index";
import { clustersRoute } from "./routes/clusters/index";
import { logger } from "./utils/logger";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM 用の __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../openapi.json"), "utf8")
);

const app = new Hono();

// リクエストログミドルウェア
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }, `${c.req.method} ${c.req.path}`);
});

// グローバルエラーハンドラー
app.onError((err, c) => {
  logger.error({
    err,
    method: c.req.method,
    path: c.req.path,
  }, "Unhandled error");
  return c.json({ error: "Internal Server Error" }, 500);
});

app.get("/openapi.json", (c) => c.json(openapi));
app.route("/api/notes", notesRoute);
app.route("/api/search", searchRoute);
app.route("/api/gpt", gptRoute);
app.route("/api/clusters", clustersRoute);
app.get("/", (c) => c.text("brain-cabinet API running"));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);
});
