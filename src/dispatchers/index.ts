/**
 * Brain Cabinet v3 — Command Dispatcher
 *
 * すべてのコマンドを action 名に基づいてディスパッチする中枢モジュール
 */

import type { BrainCommand, CommandResponse } from "../types/command";
import { logger } from "../utils/logger";

// ドメイン別ディスパッチャー
import { noteDispatcher } from "./noteDispatcher";
import { searchDispatcher } from "./searchDispatcher";
import { clusterDispatcher } from "./clusterDispatcher";
import { driftDispatcher } from "./driftDispatcher";
import { ptmDispatcher } from "./ptmDispatcher";
import { influenceDispatcher } from "./influenceDispatcher";
import { clusterDynamicsDispatcher } from "./clusterDynamicsDispatcher";
import { insightDispatcher } from "./insightDispatcher";
import { analyticsDispatcher } from "./analyticsDispatcher";
import { gptDispatcher } from "./gptDispatcher";
import { systemDispatcher } from "./systemDispatcher";

// ============================================
// ディスパッチャーレジストリ
// ============================================
type Handler = (payload: unknown) => Promise<unknown>;
const dispatchers = new Map<string, Handler>();

/**
 * ドメイン別ディスパッチャーを登録
 */
function register(
  prefix: string,
  dispatcher: Record<string, (p: unknown) => Promise<unknown>>
) {
  for (const [key, handler] of Object.entries(dispatcher)) {
    dispatchers.set(`${prefix}.${key}`, handler);
  }
}

// ドメイン登録
register("note", noteDispatcher);
register("search", searchDispatcher);
register("cluster", clusterDispatcher);
register("drift", driftDispatcher);
register("ptm", ptmDispatcher);
register("influence", influenceDispatcher);
register("clusterDynamics", clusterDynamicsDispatcher);
register("insight", insightDispatcher);
register("analytics", analyticsDispatcher);
register("gpt", gptDispatcher);
register("system", systemDispatcher);
register("debug", systemDispatcher); // debug は system と同じハンドラーを使用
register("embedding", systemDispatcher); // embedding も system に含める
register("workflow", insightDispatcher); // workflow は insight に含める

// ============================================
// メインディスパッチャー
// ============================================
export async function dispatch(cmd: BrainCommand): Promise<CommandResponse> {
  const startTime = Date.now();
  const handler = dispatchers.get(cmd.action);

  if (!handler) {
    logger.warn({ action: cmd.action }, "Unknown command action");
    return {
      success: false,
      action: cmd.action,
      error: {
        code: "UNKNOWN_ACTION",
        message: `Unknown action: ${cmd.action}`,
      },
      timestamp: Date.now(),
    };
  }

  try {
    const payload = "payload" in cmd ? cmd.payload : undefined;
    const result = await handler(payload);

    const duration = Date.now() - startTime;
    logger.info({ action: cmd.action, duration }, "Command executed");

    return {
      success: true,
      action: cmd.action,
      result,
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      { action: cmd.action, error, duration },
      "Command execution failed"
    );

    return {
      success: false,
      action: cmd.action,
      error: {
        code: "EXECUTION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      timestamp: Date.now(),
    };
  }
}

// ============================================
// 利用可能なアクション一覧を取得
// ============================================
export function getAvailableActions(): string[] {
  return Array.from(dispatchers.keys()).sort();
}
