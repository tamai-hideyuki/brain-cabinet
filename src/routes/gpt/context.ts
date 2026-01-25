import { Hono } from "hono";
import { getContextForGPT } from "../../services/gptService";
import { getGptContext } from "../../services/gptService/context/gptContext";

export const contextRoute = new Hono();

/**
 * GPT向けコンテキスト取得
 * GET /api/gpt/notes/:id/context
 *
 * Query params:
 * - full: 全文を含める（true/false、デフォルト: true）
 * - history: 履歴を含める（true/false、デフォルト: true）
 * - historyLimit: 履歴件数制限（デフォルト: 3）
 * - outline: アウトラインを含める（true/false、デフォルト: true）
 * - bullets: 箇条書きを含める（true/false、デフォルト: false）
 */
contextRoute.get("/notes/:id/context", async (c) => {
  const id = c.req.param("id");

  const includeFullContent = c.req.query("full") !== "false";
  const includeHistory = c.req.query("history") !== "false";
  const historyLimitParam = c.req.query("historyLimit");
  const historyLimit = historyLimitParam ? parseInt(historyLimitParam, 10) : 3;
  const includeOutline = c.req.query("outline") !== "false";
  const includeBulletPoints = c.req.query("bullets") === "true";

  const context = await getContextForGPT(id, {
    includeFullContent,
    includeHistory,
    historyLimit,
    includeOutline,
    includeBulletPoints,
  });
  return c.json(context);
});

// ============================================================
// v5.13 GPT向け統合コンテキスト
// ============================================================

/**
 * GPT向け統合コンテキスト取得
 * GET /api/gpt/context
 *
 * 複数の分析APIを集約し、GPTが効率的に活用できる形式で提供
 *
 * Query params:
 * - focus: フォーカス領域（overview/trends/warnings/recommendations、デフォルト: overview）
 * - maxPriorities: 優先事項の最大件数（デフォルト: 5）
 * - maxRecommendations: レコメンデーションの最大件数（デフォルト: 3）
 */
contextRoute.get("/context", async (c) => {
  const focus = c.req.query("focus") as "overview" | "trends" | "warnings" | "recommendations" | undefined;
  const maxPrioritiesParam = c.req.query("maxPriorities");
  const maxRecommendationsParam = c.req.query("maxRecommendations");

  const options = {
    focus: focus ?? "overview",
    maxPriorities: maxPrioritiesParam ? parseInt(maxPrioritiesParam, 10) : 5,
    maxRecommendations: maxRecommendationsParam ? parseInt(maxRecommendationsParam, 10) : 3,
  };

  const context = await getGptContext(options);
  return c.json(context);
});
