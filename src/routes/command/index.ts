/**
 * Brain Cabinet v3 — Command API Route
 *
 * POST /api/command
 *
 * すべての操作を単一エンドポイントで受け付ける
 */

import { Hono } from "hono";
import { dispatch, getAvailableActions } from "../../dispatchers";
import type { BrainCommand } from "../../types/command";
import { logger } from "../../utils/logger";

const app = new Hono();

/**
 * POST /api/command
 *
 * リクエストボディ:
 * {
 *   "action": "note.create",
 *   "payload": { "title": "New Note", "content": "..." }
 * }
 */
const handleCommand = async (c: { req: { json: <T>() => Promise<T> }; json: (data: unknown, status?: number) => Response }) => {
  let body: BrainCommand;

  try {
    body = await c.req.json<BrainCommand>();
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_JSON",
          message: "Invalid JSON in request body",
        },
        timestamp: Date.now(),
      },
      400
    );
  }

  // action の存在チェック
  if (!body.action) {
    return c.json(
      {
        success: false,
        error: {
          code: "MISSING_ACTION",
          message: "action is required",
        },
        timestamp: Date.now(),
      },
      400
    );
  }

  // action の形式チェック（domain.operation）
  if (!body.action.includes(".")) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_ACTION_FORMAT",
          message: "action must be in format: domain.operation (e.g., note.create)",
        },
        timestamp: Date.now(),
      },
      400
    );
  }

  logger.info({ action: body.action }, "Command received");

  const result = await dispatch(body);

  return c.json(result, result.success ? 200 : 400);
};

app.post("/", handleCommand);
app.post("/:domain", handleCommand);

/**
 * GET /api/command/actions
 *
 * 利用可能なアクション一覧を返す（開発・デバッグ用）
 */
app.get("/actions", (c) => {
  const actions = getAvailableActions();

  // ドメイン別にグルーピング
  const grouped: Record<string, string[]> = {};
  for (const action of actions) {
    const [domain] = action.split(".");
    if (!grouped[domain]) {
      grouped[domain] = [];
    }
    grouped[domain].push(action);
  }

  return c.json({
    total: actions.length,
    domains: Object.keys(grouped).sort(),
    actions: grouped,
  });
});

export default app;
