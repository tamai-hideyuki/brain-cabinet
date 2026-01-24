/**
 * 静的ファイル配信ルート
 *
 * - UI静的ファイル（assets, public）
 * - SPA fallback
 * - favicon / iOSアイコン
 */
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const staticRoutes = new Hono();

// UI静的ファイル配信
const rewriteUiPath = (p: string) => p.replace(/^\/ui/, "");

staticRoutes.use(
  "/ui/assets/*",
  serveStatic({ root: "./ui/dist", rewriteRequestPath: rewriteUiPath })
);

// UI public静的ファイル（favicon, apple-touch-icon, manifestなど）
staticRoutes.use(
  "/ui/*.png",
  serveStatic({ root: "./ui/dist", rewriteRequestPath: rewriteUiPath })
);
staticRoutes.use(
  "/ui/*.ico",
  serveStatic({ root: "./ui/dist", rewriteRequestPath: rewriteUiPath })
);
staticRoutes.use(
  "/ui/*.json",
  serveStatic({ root: "./ui/dist", rewriteRequestPath: rewriteUiPath })
);

// /ui → /ui/ へリダイレクト
staticRoutes.get("/ui", (c) => c.redirect("/ui/"));

// SPA fallback: /ui/* へのリクエストはすべてindex.htmlを返す
staticRoutes.get("/ui/*", async (c) => {
  const indexPath = path.join(__dirname, "../../ui/dist/index.html");
  const html = fs.readFileSync(indexPath, "utf8");
  return c.html(html);
});

// iOS Safari用: ルートレベルでのアイコン配信
staticRoutes.get("/apple-touch-icon.png", async (c) => {
  const iconPath = path.join(__dirname, "../../ui/dist/apple-touch-icon.png");
  const icon = fs.readFileSync(iconPath);
  return c.body(icon, 200, { "Content-Type": "image/png" });
});

staticRoutes.get("/apple-touch-icon-precomposed.png", async (c) => {
  const iconPath = path.join(__dirname, "../../ui/dist/apple-touch-icon.png");
  const icon = fs.readFileSync(iconPath);
  return c.body(icon, 200, { "Content-Type": "image/png" });
});

staticRoutes.get("/favicon.ico", async (c) => {
  const iconPath = path.join(__dirname, "../../ui/dist/brain-cabinet.png");
  const icon = fs.readFileSync(iconPath);
  return c.body(icon, 200, { "Content-Type": "image/png" });
});

// ========== Knowledge UI 静的ファイル配信 ==========
const rewriteKnowledgePath = (p: string) => p.replace(/^\/knowledge/, "");

staticRoutes.use(
  "/knowledge/assets/*",
  serveStatic({
    root: "./packages/knowledge/ui/dist",
    rewriteRequestPath: rewriteKnowledgePath,
  })
);

staticRoutes.use(
  "/knowledge/*.png",
  serveStatic({
    root: "./packages/knowledge/ui/dist",
    rewriteRequestPath: rewriteKnowledgePath,
  })
);
staticRoutes.use(
  "/knowledge/*.ico",
  serveStatic({
    root: "./packages/knowledge/ui/dist",
    rewriteRequestPath: rewriteKnowledgePath,
  })
);
staticRoutes.use(
  "/knowledge/*.json",
  serveStatic({
    root: "./packages/knowledge/ui/dist",
    rewriteRequestPath: rewriteKnowledgePath,
  })
);

// /knowledge → /knowledge/ へリダイレクト
staticRoutes.get("/knowledge", (c) => c.redirect("/knowledge/"));

// Knowledge SPA fallback
staticRoutes.get("/knowledge/*", async (c) => {
  const indexPath = path.join(
    __dirname,
    "../../packages/knowledge/ui/dist/index.html"
  );
  try {
    const html = fs.readFileSync(indexPath, "utf8");
    return c.html(html);
  } catch {
    // ビルドされていない場合は開発サーバーへリダイレクト
    return c.redirect("http://localhost:5174/");
  }
});
