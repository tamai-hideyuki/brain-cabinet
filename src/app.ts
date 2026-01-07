/**
 * Honoアプリケーション初期化
 *
 * ミドルウェア・ルートを組み立ててアプリを構築する
 */
import { Hono } from "hono";
import { applyMiddleware } from "./middleware";
import { apiRoutes } from "./routes/api";
import { staticRoutes } from "./routes/static";
import { openapi } from "./config/openapi";

export const app = new Hono();

// ミドルウェア適用
applyMiddleware(app);

// OpenAPI仕様エンドポイント
app.get("/openapi.json", (c) => c.json(openapi));

// APIルート
app.route("/api", apiRoutes);

// 静的ファイル配信
app.route("/", staticRoutes);

// ルートエンドポイント
app.get("/", (c) => c.text("brain-cabinet API running"));
