import { Hono } from "hono";
import {
  searchForGPT,
  getContextForGPT,
  prepareGPTTask,
  getNotesOverviewForGPT,
  GPTTaskType,
} from "../services/gptService";
import { logger } from "../utils/logger";

export const gptRoute = new Hono();

/**
 * GPT向け複合検索
 * GET /api/gpt/search
 *
 * Query params:
 * - query: 検索クエリ（必須）
 * - searchIn: 検索対象（カンマ区切り、デフォルト: title,content,tags）
 * - category: カテゴリフィルター
 * - limit: 件数制限（デフォルト: 10）
 * - includeHistory: 履歴件数を含める（true/false）
 */
gptRoute.get("/search", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    return c.json({ error: "query is required" }, 400);
  }

  const searchInParam = c.req.query("searchIn");
  const searchIn = searchInParam
    ? (searchInParam.split(",") as ("title" | "content" | "tags" | "headings")[])
    : undefined;

  const category = c.req.query("category");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const includeHistory = c.req.query("includeHistory") === "true";

  try {
    const result = await searchForGPT({
      query: decodeURIComponent(query),
      searchIn,
      category,
      limit,
      includeHistory,
    });
    return c.json(result);
  } catch (e) {
    logger.error({ err: e, query, searchIn, category, limit }, "GPT search failed");
    return c.json({ error: (e as Error).message }, 500);
  }
});

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
gptRoute.get("/notes/:id/context", async (c) => {
  const id = c.req.param("id");

  const includeFullContent = c.req.query("full") !== "false";
  const includeHistory = c.req.query("history") !== "false";
  const historyLimitParam = c.req.query("historyLimit");
  const historyLimit = historyLimitParam ? parseInt(historyLimitParam, 10) : 3;
  const includeOutline = c.req.query("outline") !== "false";
  const includeBulletPoints = c.req.query("bullets") === "true";

  try {
    const context = await getContextForGPT(id, {
      includeFullContent,
      includeHistory,
      historyLimit,
      includeOutline,
      includeBulletPoints,
    });
    return c.json(context);
  } catch (e) {
    logger.error({ err: e, noteId: id }, "GPT context fetch failed");
    return c.json({ error: (e as Error).message }, 404);
  }
});

/**
 * GPT向けタスク準備
 * POST /api/gpt/task
 *
 * Body:
 * - type: タスクタイプ（extract_key_points, summarize, generate_ideas, find_related, compare_versions, create_outline）
 * - noteId: 対象ノートID（タスクによって必須）
 * - query: 検索クエリ（find_relatedで使用）
 * - options: 追加オプション
 */
gptRoute.post("/task", async (c) => {
  let taskType: string | undefined;
  let noteId: string | undefined;
  try {
    const body = await c.req.json();
    const { type, noteId: nId, query, options } = body;
    taskType = type;
    noteId = nId;

    if (!type) {
      return c.json({ error: "type is required" }, 400);
    }

    const validTypes: GPTTaskType[] = [
      "extract_key_points",
      "summarize",
      "generate_ideas",
      "find_related",
      "compare_versions",
      "create_outline",
    ];

    if (!validTypes.includes(type)) {
      return c.json({
        error: `Invalid type. Valid types: ${validTypes.join(", ")}`,
      }, 400);
    }

    const result = await prepareGPTTask({ type, noteId: nId, query, options });
    return c.json(result);
  } catch (e) {
    logger.error({ err: e, taskType, noteId }, "GPT task failed");
    return c.json({ error: (e as Error).message }, 400);
  }
});

/**
 * GPT向け概要情報
 * GET /api/gpt/overview
 *
 * Brain Cabinet全体の統計情報をGPT向けに提供
 */
gptRoute.get("/overview", async (c) => {
  try {
    const overview = await getNotesOverviewForGPT();
    return c.json(overview);
  } catch (e) {
    logger.error({ err: e }, "GPT overview fetch failed");
    return c.json({ error: (e as Error).message }, 500);
  }
});

/**
 * GPT向けタスクタイプ一覧
 * GET /api/gpt/tasks
 *
 * 利用可能なタスクタイプとその説明
 */
gptRoute.get("/tasks", (c) => {
  return c.json({
    availableTasks: [
      {
        type: "extract_key_points",
        description: "ノートから要点を抽出",
        requiresNoteId: true,
        example: { type: "extract_key_points", noteId: "xxx" },
      },
      {
        type: "summarize",
        description: "ノートを要約",
        requiresNoteId: true,
        example: { type: "summarize", noteId: "xxx" },
      },
      {
        type: "generate_ideas",
        description: "ノートを基にアイデア生成",
        requiresNoteId: true,
        example: { type: "generate_ideas", noteId: "xxx" },
      },
      {
        type: "find_related",
        description: "関連ノートを検索",
        requiresNoteId: false,
        requiresQuery: true,
        example: { type: "find_related", query: "TypeScript" },
      },
      {
        type: "compare_versions",
        description: "ノートの変更履歴を比較",
        requiresNoteId: true,
        example: { type: "compare_versions", noteId: "xxx" },
      },
      {
        type: "create_outline",
        description: "ノートのアウトラインを作成/改善",
        requiresNoteId: true,
        example: { type: "create_outline", noteId: "xxx" },
      },
    ],
  });
});
