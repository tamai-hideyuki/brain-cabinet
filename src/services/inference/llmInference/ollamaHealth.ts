/**
 * Ollama ヘルスチェック
 *
 * Ollamaサーバーの状態とモデルの可用性を確認する
 */

import { logger } from "../../../utils/logger";

// ============================================================
// 設定
// ============================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const HEALTH_CHECK_TIMEOUT = 5000; // 5秒

// ============================================================
// 型定義
// ============================================================

export type OllamaHealthStatus = {
  available: boolean;
  modelLoaded: boolean;
  model: string;
  message: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
  }>;
};

// ============================================================
// ヘルスチェック
// ============================================================

/**
 * Ollamaサーバーの状態を確認する
 */
export async function checkOllamaHealth(): Promise<OllamaHealthStatus> {
  const result: OllamaHealthStatus = {
    available: false,
    modelLoaded: false,
    model: OLLAMA_MODEL,
    message: "",
  };

  try {
    // 1. サーバー接続確認
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      result.message = `Ollamaサーバーエラー: ${response.status} ${response.statusText}`;
      logger.warn({ status: response.status }, "Ollama server returned error");
      return result;
    }

    result.available = true;

    // 2. モデル確認
    const data = (await response.json()) as OllamaTagsResponse;
    const models = data.models ?? [];

    // モデル名の正規化（タグ付きとタグなしの両方をチェック）
    const normalizedTarget = normalizeModelName(OLLAMA_MODEL);
    const modelFound = models.some((m) => {
      const normalizedName = normalizeModelName(m.name);
      return normalizedName === normalizedTarget;
    });

    if (modelFound) {
      result.modelLoaded = true;
      result.message = `Ollama準備完了 (${OLLAMA_MODEL})`;
    } else {
      const availableModels = models.map((m) => m.name).join(", ") || "なし";
      result.message = `モデル '${OLLAMA_MODEL}' が見つかりません。\n` +
        `利用可能なモデル: ${availableModels}\n` +
        `インストール: ollama pull ${OLLAMA_MODEL}`;
      logger.warn(
        { model: OLLAMA_MODEL, available: availableModels },
        "Required model not found"
      );
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      result.message = "Ollamaサーバーに接続できません（タイムアウト）。\n" +
        "起動コマンド: ollama serve";
    } else if (error instanceof TypeError && error.message.includes("fetch")) {
      result.message = "Ollamaサーバーに接続できません。\n" +
        "起動コマンド: ollama serve";
    } else {
      result.message = `Ollamaヘルスチェック失敗: ${error instanceof Error ? error.message : "Unknown error"}`;
    }

    logger.warn({ error }, "Ollama health check failed");
    return result;
  }
}

/**
 * モデル名を正規化（タグを除去）
 */
function normalizeModelName(name: string): string {
  // "qwen2.5:3b" → "qwen2.5:3b"
  // "qwen2.5:3b-instruct" → "qwen2.5:3b-instruct"
  // タグなしの場合は :latest を付与して比較
  if (!name.includes(":")) {
    return `${name}:latest`;
  }
  return name.toLowerCase();
}

/**
 * Ollamaが利用可能かどうかを簡易チェック
 */
export async function isOllamaAvailable(): Promise<boolean> {
  const health = await checkOllamaHealth();
  return health.available && health.modelLoaded;
}

// ============================================================
// エクスポート
// ============================================================

export { OLLAMA_BASE_URL, OLLAMA_MODEL };
