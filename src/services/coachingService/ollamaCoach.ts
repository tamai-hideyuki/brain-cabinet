/**
 * Ollama を使ったコーチング応答生成
 */

import { logger } from "../../utils/logger";
import type { CoachingPhase } from "../../db/schema";
import { getSystemPromptWithPhase } from "./prompts";

// ============================================================
// 設定
// ============================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_COACHING_MODEL ?? process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const OLLAMA_TIMEOUT = 60000; // 60秒

// ============================================================
// Ollama API
// ============================================================

type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatRequest = {
  model: string;
  messages: OllamaChatMessage[];
  stream: false;
  options?: {
    temperature?: number;
    num_predict?: number;
    num_ctx?: number;
  };
};

type OllamaChatResponse = {
  model: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
};

/**
 * Ollama Chat API を呼び出す
 */
async function callOllamaChat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as OllamaChatResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Ollama の可用性をチェック
 */
export async function isOllamaAvailableForCoaching(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================================
// コーチング応答生成
// ============================================================

export type GenerateCoachResponseInput = {
  phase: CoachingPhase;
  history: Array<{ role: "coach" | "user"; content: string }>;
  userMessage: string;
};

export type GenerateCoachResponseResult = {
  content: string;
  model: string;
  usedOllama: boolean;
};

/**
 * Ollama を使ってコーチの応答を生成
 */
export async function generateCoachResponseWithOllama(
  input: GenerateCoachResponseInput
): Promise<GenerateCoachResponseResult> {
  const { phase, history, userMessage } = input;

  // システムプロンプトを取得
  const systemPrompt = getSystemPromptWithPhase(phase);

  // 会話履歴をOllama形式に変換
  const messages: OllamaChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // 過去の会話を追加（直近10ターンまで）
  const recentHistory = history.slice(-20); // coach + user で最大10ターン
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "coach" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // 最新のユーザーメッセージを追加
  messages.push({ role: "user", content: userMessage });

  logger.debug({
    phase,
    historyLength: history.length,
    messageCount: messages.length,
    model: OLLAMA_MODEL,
  }, "Generating coach response with Ollama");

  try {
    const response = await callOllamaChat({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.7, // コーチングは少し創造的に
        num_predict: 500, // 応答は短めに
        num_ctx: 8192,
      },
    });

    const content = response.message.content.trim();

    logger.debug({
      phase,
      responseLength: content.length,
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
    }, "Coach response generated with Ollama");

    return {
      content,
      model: OLLAMA_MODEL,
      usedOllama: true,
    };
  } catch (error) {
    logger.error({ error, phase }, "Failed to generate coach response with Ollama");
    throw error;
  }
}

// ============================================================
// エクスポート
// ============================================================

export { OLLAMA_MODEL as COACHING_MODEL };
