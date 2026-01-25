/**
 * ヘルスチェックサービス
 * サーバーの状態を確認するための機能を提供
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { notes } from "../../db/schema";
import {
  checkOllamaHealth,
  type OllamaHealthStatus,
} from "../inference/llmInference/ollamaHealth";

// サーバー起動時刻を記録
const serverStartTime = Date.now();

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  status: HealthStatus;
  latency?: number;
  message: string;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    storage: {
      status: HealthStatus;
      notesCount: number;
      message: string;
    };
    ollama: OllamaHealthStatus;
  };
  gptSummary: string;
}

/**
 * データベース接続をチェック
 */
const checkDatabase = async (): Promise<ComponentHealth> => {
  const start = Date.now();
  try {
    // 簡単なクエリで接続確認
    await db.select({ count: sql<number>`1` }).from(notes).limit(1);
    const latency = Date.now() - start;

    return {
      status: "healthy",
      latency,
      message: `SQLite接続正常 (${latency}ms)`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: `データベース接続エラー: ${(error as Error).message}`,
    };
  }
};

/**
 * ストレージ統計を取得
 */
const checkStorage = async (): Promise<{
  status: HealthStatus;
  notesCount: number;
  message: string;
}> => {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes);
    const notesCount = result[0]?.count ?? 0;

    return {
      status: "healthy",
      notesCount,
      message: `${notesCount}件のノートを保存中`,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      notesCount: 0,
      message: `ストレージ確認エラー: ${(error as Error).message}`,
    };
  }
};

/**
 * Ollama状態をチェック
 */
const checkOllama = async (): Promise<OllamaHealthStatus> => {
  try {
    return await checkOllamaHealth();
  } catch (error) {
    return {
      available: false,
      modelLoaded: false,
      model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b",
      message: `ヘルスチェック例外: ${(error as Error).message}`,
    };
  }
};

/**
 * 総合ステータスを判定
 */
const determineOverallStatus = (
  dbStatus: HealthStatus,
  storageStatus: HealthStatus,
  ollamaAvailable: boolean
): HealthStatus => {
  if (dbStatus === "unhealthy") return "unhealthy";
  if (storageStatus === "unhealthy") return "degraded";
  if (dbStatus === "degraded" || storageStatus === "degraded") return "degraded";
  // Ollama障害はdegraded扱い（クリティカルではないがLLM機能が使えない）
  if (!ollamaAvailable) return "degraded";
  return "healthy";
};

/**
 * アップタイムをフォーマット
 */
const formatUptime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}日 ${hours % 24}時間`;
  if (hours > 0) return `${hours}時間 ${minutes % 60}分`;
  if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
  return `${seconds}秒`;
};

/**
 * ヘルスチェックを実行
 */
export const performHealthCheck = async (): Promise<HealthCheckResult> => {
  const [dbHealth, storageHealth, ollamaHealth] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkOllama(),
  ]);

  const uptime = Date.now() - serverStartTime;
  const overallStatus = determineOverallStatus(
    dbHealth.status,
    storageHealth.status,
    ollamaHealth.available && ollamaHealth.modelLoaded
  );

  // GPT向けサマリー生成
  const statusEmoji = {
    healthy: "✅",
    degraded: "⚠️",
    unhealthy: "❌",
  };

  const ollamaStatus = ollamaHealth.available && ollamaHealth.modelLoaded;

  const gptSummary = `
Brain Cabinet サーバー状態: ${statusEmoji[overallStatus]} ${overallStatus === "healthy" ? "正常稼働中" : overallStatus === "degraded" ? "一部機能に問題あり" : "障害発生中"}
稼働時間: ${formatUptime(uptime)}
データベース: ${statusEmoji[dbHealth.status]} ${dbHealth.message}
ストレージ: ${statusEmoji[storageHealth.status]} ${storageHealth.message}
Ollama LLM: ${ollamaStatus ? "✅" : "❌"} ${ollamaHealth.message}
`.trim();

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime / 1000),
    checks: {
      database: dbHealth,
      storage: storageHealth,
      ollama: ollamaHealth,
    },
    gptSummary,
  };
};
