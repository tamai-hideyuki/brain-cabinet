/**
 * Ollama クライアント
 *
 * Ollama REST API を呼び出してLLM推論を実行する
 */

import { logger } from "../../../utils/logger";
import type {
  OllamaGenerateResponse,
  LlmParsedResult,
  LlmInferenceConfidenceDetail,
} from "./types";
import { DEFAULT_SEED, INFERENCE_VERSION } from "./types";
import { getInferencePromptWithFewShot } from "./prompts";
import type { NoteType, Intent, DecayProfile } from "../../../db/schema";

// ============================================================
// 設定
// ============================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:3b";
const OLLAMA_TIMEOUT = 60000; // 60秒

// ============================================================
// JSON修復関数
// ============================================================

/**
 * 不正なJSONを修復する
 * LLMが稀に出力するフォーマット崩れに対応
 */
function autoRepairJson(output: string): string {
  let repaired = output;

  // 前後の余分な文字を削除
  repaired = repaired.trim();

  // コードブロックを除去
  repaired = repaired.replace(/^```json?\n?/i, "");
  repaired = repaired.replace(/\n?```$/i, "");

  // JSONオブジェクトを抽出（LLMが説明文を付けた場合に対応）
  // 最初の { から開始
  const firstBrace = repaired.indexOf("{");
  if (firstBrace !== -1) {
    repaired = repaired.slice(firstBrace);
  }

  // 改行をスペースに置換（JSON内の不正改行対策）
  repaired = repaired.replace(/\n/g, " ");

  // 単一引用符を二重引用符に
  repaired = repaired.replace(/'/g, '"');

  // 末尾のカンマを除去
  repaired = repaired.replace(/,\s*}/g, "}");
  repaired = repaired.replace(/,\s*]/g, "]");

  // 括弧のバランスを修復
  repaired = repairBrackets(repaired);

  return repaired;
}

/**
 * 括弧のバランスを修復する
 * 開いている括弧を閉じる、または不完全な末尾を削除
 */
function repairBrackets(json: string): string {
  let repaired = json;

  // 開いている括弧をカウント
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of repaired) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    if (char === "[") bracketCount++;
    if (char === "]") bracketCount--;
  }

  // 文字列が閉じていない場合
  if (inString) {
    repaired += '"';
    // 再度カウント
    return repairBrackets(repaired);
  }

  // 括弧が閉じていない場合、末尾の不完全な要素を削除して括弧を追加
  if (braceCount > 0 || bracketCount > 0) {
    // 末尾の不完全な要素を削除（複数パターン対応）
    // 1. 不完全な文字列値: "key": "incomplete...
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, "");
    // 2. 不完全なキー: "incomplete...
    repaired = repaired.replace(/,\s*"[^"]*$/, "");
    // 3. 不完全なオブジェクト: { ...
    repaired = repaired.replace(/,\s*\{[^}]*$/, "");
    // 4. 末尾のカンマ
    repaired = repaired.replace(/,\s*$/, "");

    // 再度カウントして正確な括弧数を計算
    braceCount = 0;
    bracketCount = 0;
    inString = false;
    escapeNext = false;

    for (const char of repaired) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
      if (char === "[") bracketCount++;
      if (char === "]") bracketCount--;
    }

    // 閉じ括弧を追加
    for (let i = 0; i < bracketCount; i++) {
      repaired += "]";
    }
    for (let i = 0; i < braceCount; i++) {
      repaired += "}";
    }
  }

  return repaired;
}

/**
 * JSON パースを試行し、失敗時は修復して再試行
 */
function tryParseWithRepair(output: string, maxRetries = 2): object {
  // 最初から修復を適用（LLMが余計な説明文を付けることが多い）
  let current = autoRepairJson(output);

  for (let i = 0; i < maxRetries; i++) {
    try {
      return JSON.parse(current);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn({
        attempt: i + 1,
        maxRetries,
        originalOutput: output.slice(0, 500),
        repairedOutput: current.slice(0, 500),
        parseError: errorMessage,
      }, "JSON parse failed, attempting further repair");
      current = autoRepairJson(current);
    }
  }

  // 最終的に失敗した場合、詳細なエラー情報をログに残す
  logger.error({
    originalOutput: output,
    finalRepairedOutput: current,
  }, "JSON parse failed after all repair attempts");

  throw new Error(`JSON parse failed after ${maxRetries} repair attempts`);
}

// ============================================================
// Ollamaリクエスト
// ============================================================

type OllamaGenerateRequest = {
  model: string;
  prompt: string;
  stream: false;
  options?: {
    temperature?: number;
    seed?: number;
    num_predict?: number;
    num_ctx?: number;
  };
};

/**
 * Ollama API を呼び出す
 */
async function callOllama(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
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

    return (await response.json()) as OllamaGenerateResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 推論実行
// ============================================================

export type InferWithLlmOptions = {
  model?: string;
  seed?: number;
  temperature?: number;
};

export type InferWithLlmResult = {
  result: LlmParsedResult;
  model: string;
  promptTokens: number;
  completionTokens: number;
  inferenceVersion: string;
  seed: number;
};

/**
 * Ollama を使ってノートを分類する
 *
 * Few-shot学習: ユーザーが承認した過去の分類例をプロンプトに含めることで、
 * ユーザー固有の分類傾向を学習した推論を行う
 */
export async function inferWithOllama(
  noteContent: string,
  noteTitle: string,
  options: InferWithLlmOptions = {}
): Promise<InferWithLlmResult> {
  const model = options.model ?? OLLAMA_MODEL;
  const seed = options.seed ?? DEFAULT_SEED;
  const temperature = options.temperature ?? 0.3;

  // Few-shot例を含むプロンプトを生成（非同期）
  const prompt = await getInferencePromptWithFewShot(noteContent, noteTitle);

  logger.debug({
    model,
    seed,
    contentLength: noteContent.length,
    titleLength: noteTitle.length,
    promptLength: prompt.length,
  }, "Calling Ollama for inference with few-shot examples");

  const response = await callOllama({
    model,
    prompt,
    stream: false,
    options: {
      temperature,
      seed,
      num_predict: 1000, // 出力トークン上限（500では切れるケースがあったため増加）
      num_ctx: 8192, // コンテキストサイズ（デフォルト4096では長いプロンプトが切り詰められる）
    },
  });

  // レスポンスをパース
  const parsed = tryParseWithRepair(response.response) as Record<string, unknown>;

  // 結果を正規化
  const result = normalizeResult(parsed);

  return {
    result,
    model,
    promptTokens: response.prompt_eval_count ?? 0,
    completionTokens: response.eval_count ?? 0,
    inferenceVersion: INFERENCE_VERSION,
    seed,
  };
}

// ============================================================
// 結果の正規化
// ============================================================

const VALID_TYPES: NoteType[] = ["decision", "learning", "scratch", "emotion", "log"];
const VALID_INTENTS: Intent[] = ["architecture", "design", "implementation", "review", "process", "people", "unknown"];
const VALID_DECAY_PROFILES: DecayProfile[] = ["stable", "exploratory", "situational"];

function normalizeResult(parsed: Record<string, unknown>): LlmParsedResult {
  // type
  const rawType = String(parsed.type ?? "scratch");
  const type: NoteType = VALID_TYPES.includes(rawType as NoteType)
    ? (rawType as NoteType)
    : "scratch";

  // intent
  const rawIntent = String(parsed.intent ?? "unknown");
  const intent: Intent = VALID_INTENTS.includes(rawIntent as Intent)
    ? (rawIntent as Intent)
    : "unknown";

  // confidence
  const rawConfidence = Number(parsed.confidence ?? 0.5);
  const confidence = Math.max(0, Math.min(1, rawConfidence));

  // confidenceDetail
  const rawDetail = (parsed.confidenceDetail ?? parsed.confidence_detail ?? {}) as Record<string, unknown>;
  const confidenceDetail: LlmInferenceConfidenceDetail = {
    structural: Math.max(0, Math.min(1, Number(rawDetail.structural ?? 0.5))),
    semantic: Math.max(0, Math.min(1, Number(rawDetail.semantic ?? 0.5))),
    reasoning: Math.max(0, Math.min(1, Number(rawDetail.reasoning ?? 0.5))),
  };

  // decayProfile
  const rawDecay = String(parsed.decayProfile ?? parsed.decay_profile ?? "exploratory");
  const decayProfile: DecayProfile = VALID_DECAY_PROFILES.includes(rawDecay as DecayProfile)
    ? (rawDecay as DecayProfile)
    : "exploratory";

  // reasoning
  const reasoning = String(parsed.reasoning ?? "推論理由が取得できませんでした");

  return {
    type,
    intent,
    confidence,
    confidenceDetail,
    decayProfile,
    reasoning,
  };
}

// ============================================================
// エクスポート
// ============================================================

export { OLLAMA_BASE_URL, OLLAMA_MODEL };
