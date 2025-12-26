import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { notesRoute } from "./routes/notes/index";
import { searchRoute } from "./routes/search/index";
import { gptRoute } from "./routes/gpt/index";
import { clustersRoute } from "./routes/clusters/index";
import { analyticsRoute } from "./routes/analytics/index";
import { driftRoute } from "./routes/drift/index";
import { influenceRoute } from "./routes/influence/index";
import { clusterDynamicsRoute } from "./routes/cluster-dynamics/index";
import { ptmRoute } from "./routes/ptm/index";
import { insightRoute } from "./routes/insight/index";
import commandRoute from "./routes/command/index";
import { bookmarksRoute } from "./routes/bookmarks/index";
import { secretBoxRoute } from "./routes/secret-box/index";
import { systemRoute } from "./routes/system/index";
import { authMiddleware } from "./middleware/auth";
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

// API認証ミドルウェア
app.use("/api/*", authMiddleware);

app.route("/api/notes", notesRoute);
app.route("/api/search", searchRoute);
app.route("/api/gpt", gptRoute);
app.route("/api/clusters", clustersRoute);
app.route("/api/analytics", analyticsRoute);
app.route("/api/drift", driftRoute);
app.route("/api/influence", influenceRoute);
app.route("/api/cluster-dynamics", clusterDynamicsRoute);
app.route("/api/ptm", ptmRoute);
app.route("/api/insight", insightRoute);
app.route("/api/v1", commandRoute);
app.route("/api/bookmarks", bookmarksRoute);
app.route("/api/secret-box", secretBoxRoute);
app.route("/api/system", systemRoute);

// UI静的ファイル配信
app.use("/ui/assets/*", serveStatic({ root: "./ui/dist", rewriteRequestPath: (p) => p.replace(/^\/ui/, "") }));
// UI public静的ファイル（favicon, apple-touch-icon, manifestなど）
app.use("/ui/*.png", serveStatic({ root: "./ui/dist", rewriteRequestPath: (p) => p.replace(/^\/ui/, "") }));
app.use("/ui/*.ico", serveStatic({ root: "./ui/dist", rewriteRequestPath: (p) => p.replace(/^\/ui/, "") }));
app.use("/ui/*.json", serveStatic({ root: "./ui/dist", rewriteRequestPath: (p) => p.replace(/^\/ui/, "") }));
app.get("/ui", (c) => c.redirect("/ui/"));
// SPA fallback: /ui/* へのリクエストはすべてindex.htmlを返す
app.get("/ui/*", async (c) => {
  const indexPath = path.join(__dirname, "../ui/dist/index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  return c.html(html);
});

// iOS Safari用: ルートレベルでのアイコン配信
app.get("/apple-touch-icon.png", async (c) => {
  const iconPath = path.join(__dirname, "../ui/dist/apple-touch-icon.png");
  const icon = fs.readFileSync(iconPath);
  return c.body(icon, 200, { "Content-Type": "image/png" });
});
app.get("/apple-touch-icon-precomposed.png", async (c) => {
  const iconPath = path.join(__dirname, "../ui/dist/apple-touch-icon.png");
  const icon = fs.readFileSync(iconPath);
  return c.body(icon, 200, { "Content-Type": "image/png" });
});
app.get("/favicon.ico", async (c) => {
  const iconPath = path.join(__dirname, "../ui/dist/brain-cabinet.png");
  const icon = fs.readFileSync(iconPath);
  return c.body(icon, 200, { "Content-Type": "image/png" });
});

app.get("/", (c) => c.text("brain-cabinet API running"));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  logger.info(`Server running on http://localhost:${info.port}`);
});
