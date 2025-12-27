/**
 * Brain Cabinet v3 — Command Dispatcher
 *
 * すべてのコマンドを action 名に基づいてディスパッチする中枢モジュール
 */

import type { BrainCommand, CommandResponse, BcMeta } from "../types/command";
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
import { jobDispatcher } from "./jobDispatcher";
import { workflowDispatcher } from "./workflowDispatcher";
import { ragDispatcher } from "./ragDispatcher";
import { decisionDispatcher } from "./decisionDispatcher";
import { promotionDispatcher } from "./promotionDispatcher";
import { reviewDispatcher } from "./reviewDispatcher";
import { bookmarkDispatcher } from "./bookmarkDispatcher";
import { isolationDispatcher } from "./isolationDispatcher";

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
register("job", jobDispatcher);
register("debug", systemDispatcher); // debug は system と同じハンドラーを使用
register("embedding", systemDispatcher); // embedding も system に含める
register("workflow", workflowDispatcher);
register("rag", ragDispatcher);
register("decision", decisionDispatcher);
register("promotion", promotionDispatcher);
register("review", reviewDispatcher);
register("bookmark", bookmarkDispatcher);
register("isolation", isolationDispatcher);

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

    // パフォーマンスメトリクス（v5.14）
    const _bcMeta: BcMeta = {
      serverLatency: duration,
      cached: false, // TODO: キャッシュヒット検出は将来拡張
      action: cmd.action,
    };

    return {
      success: true,
      action: cmd.action,
      result,
      timestamp: Date.now(),
      _bcMeta,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack, cause: error.cause }
      : error;
    logger.error(
      { action: cmd.action, error: errorInfo, duration },
      "Command execution failed"
    );

    // エラー時もメトリクスを付加
    const _bcMeta: BcMeta = {
      serverLatency: duration,
      cached: false,
      action: cmd.action,
    };

    return {
      success: false,
      action: cmd.action,
      error: {
        code: "EXECUTION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      timestamp: Date.now(),
      _bcMeta,
    };
  }
}

// ============================================
// 利用可能なアクション一覧を取得
// ============================================
export function getAvailableActions(): string[] {
  return Array.from(dispatchers.keys()).sort();
}
