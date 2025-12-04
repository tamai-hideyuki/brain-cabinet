import { Hono } from "hono";
import { searchRoute } from "./search";
import { contextRoute } from "./context";
import { taskRoute } from "./task";
import { overviewRoute } from "./overview";
import { healthRoute } from "./health";

export const gptRoute = new Hono();

// GPT向け検索
gptRoute.route("/", searchRoute);

// GPT向けコンテキスト取得
gptRoute.route("/", contextRoute);

// GPT向けタスク
gptRoute.route("/", taskRoute);

// GPT向け概要
gptRoute.route("/", overviewRoute);

// GPT向けヘルスチェック
gptRoute.route("/", healthRoute);
