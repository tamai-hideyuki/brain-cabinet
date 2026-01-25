/**
 * LLM推論機能 型定義
 *
 * v6: Ollama + Qwen2.5:3b によるローカルLLM推論
 */

import type { NoteType, Intent, DecayProfile, LlmInferenceStatus } from "../../../db/schema";

// ============================================================
// 定数
// ============================================================

/** 推論バージョン（モデル更新時に変更） */
export const INFERENCE_VERSION = "2025.01";

/** 再現性用シード値 */
export const DEFAULT_SEED = 42;

/** コンテキスト長ハードリミット（文字数） */
export const CONTEXT_HARD_LIMIT = 4000;

/** confidence閾値 */
export const CONFIDENCE_THRESHOLDS = {
  AUTO_APPLY_HIGH: 0.85,    // 自動反映（通知なし）
  AUTO_APPLY_MID: 0.7,      // 自動反映（週次通知）
  PENDING: 0.7,             // 保留
} as const;

/** バッチ処理設定 */
export const BATCH_CONFIG = {
  MAX_CONCURRENT: 2,        // 最大並行数（業務中の負荷軽減）
  MAX_CANDIDATES: 20,       // 最大候補数
} as const;

// ============================================================
// LLM推論リクエスト
// ============================================================

export type LlmInferenceRequest = {
  noteId: string;
  content: string;
  title?: string;
  currentType?: NoteType;
  previousInference?: {
    type: NoteType;
    confidence: number;
  };
};

// ============================================================
// LLM推論結果
// ============================================================

export type LlmInferenceConfidenceDetail = {
  structural: number;   // 構文分析による確信度
  semantic: number;     // 意味分析による確信度
  reasoning: number;    // 推論の論理性
};

export type LlmInferenceResult = {
  noteId: string;
  type: NoteType;
  intent: Intent;
  confidence: number;
  confidenceDetail: LlmInferenceConfidenceDetail;
  decayProfile: DecayProfile;
  reasoning: string;      // LLMの推論理由

  // メタデータ
  model: string;
  promptTokens: number;
  completionTokens: number;

  // 堅牢性メタ情報
  contextTruncated: boolean;
  fallbackUsed: boolean;
  inferenceVersion: string;
  seed: number;
};

// ============================================================
// LLM推論候補
// ============================================================

export type LlmInferenceCandidate = {
  noteId: string;
  title: string;
  content: string;
  currentType: NoteType | "unknown";
  currentConfidence: number;
  reason: string;         // 候補に選ばれた理由
};

// ============================================================
// 保留中アイテム
// ============================================================

export type PendingItem = {
  id: number;
  noteId: string;
  title: string;
  currentType: NoteType;
  suggestedType: NoteType;
  confidence: number;
  reasoning: string;
  createdAt: number;
};

// ============================================================
// 週次サマリー
// ============================================================

export type WeeklySummaryStats = {
  autoAppliedHigh: number;    // confidence >= 0.85
  autoAppliedMid: number;     // confidence 0.7-0.85
  pendingCount: number;       // confidence < 0.7
  approvedCount: number;
  overriddenCount: number;
};

export type RecentAutoAppliedItem = {
  noteId: string;
  title: string;
  type: NoteType;
  confidence: number;
  reasoning: string;
  createdAt: number;
};

export type WeeklySummary = {
  weekStart: string;          // ISO日付 'YYYY-MM-DD'
  weekEnd: string;
  stats: WeeklySummaryStats;
  recentAutoApplied: RecentAutoAppliedItem[];
  pendingItems: PendingItem[];
};

// ============================================================
// 実行結果
// ============================================================

export type LlmInferenceExecuteResultItem = {
  noteId: string;
  type: NoteType;
  confidence: number;
  status: LlmInferenceStatus | "error";
  reasoning: string;
  error?: {
    code: string;
    message: string;
  };
};

export type LlmInferenceExecuteResult = {
  executed: number;
  results: LlmInferenceExecuteResultItem[];
};

// ============================================================
// Ollamaレスポンス
// ============================================================

export type OllamaGenerateResponse = {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

export type OllamaTagsResponse = {
  models: {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: {
      parent_model?: string;
      format: string;
      family: string;
      families: string[];
      parameter_size: string;
      quantization_level: string;
    };
  }[];
};

// ============================================================
// LLMパース結果
// ============================================================

export type LlmParsedResult = {
  type: NoteType;
  intent: Intent;
  confidence: number;
  confidenceDetail: LlmInferenceConfidenceDetail;
  decayProfile: DecayProfile;
  reasoning: string;
};

// ============================================================
// ステータス判定ヘルパー
// ============================================================

export function determineStatus(confidence: number): LlmInferenceStatus {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPLY_HIGH) {
    return "auto_applied";
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPLY_MID) {
    return "auto_applied_notified";
  }
  return "pending";
}
