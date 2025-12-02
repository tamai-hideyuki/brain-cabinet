import { Hono } from "hono";
import { prepareGPTTask, GPTTaskType } from "../../services/gptService";
import { logger } from "../../utils/logger";

export const taskRoute = new Hono();

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
taskRoute.post("/task", async (c) => {
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
 * GPT向けタスクタイプ一覧
 * GET /api/gpt/tasks
 *
 * 利用可能なタスクタイプとその説明
 */
taskRoute.get("/tasks", (c) => {
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
