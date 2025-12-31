/**
 * LLM推論 Dispatcher
 *
 * LLM推論機能のAPIエンドポイント
 */

import {
  executeLlmInference,
  getPendingResults,
  getAutoAppliedNotifiedResults,
  approveResult,
  rejectResult,
  overrideResult,
  getWeeklySummary,
  getLlmInferenceCandidates,
  countLlmInferenceCandidates,
  checkOllamaHealth,
} from "../../services/inference/llmInference";
import type { NoteType } from "../../db/schema";

// ============================================================
// 型定義
// ============================================================

type GetCandidatesPayload = {
  limit?: number;
  confidenceThreshold?: number;
};

type ExecutePayload = {
  noteIds?: string[];
  limit?: number;
  dryRun?: boolean;
  model?: string;
  seed?: number;
};

type GetPendingPayload = {
  limit?: number;
  offset?: number;
};

type ApprovePayload = {
  resultId: number;
};

type RejectPayload = {
  resultId: number;
};

type OverridePayload = {
  resultId: number;
  type: NoteType;
  reason?: string;
};

// ============================================================
// ハンドラー
// ============================================================

/**
 * 推論候補を取得
 */
async function getCandidates(payload: unknown) {
  const p = (payload ?? {}) as GetCandidatesPayload;
  const candidates = await getLlmInferenceCandidates({
    limit: p.limit,
    confidenceThreshold: p.confidenceThreshold,
  });

  return {
    count: candidates.length,
    candidates: candidates.map((c) => ({
      noteId: c.noteId,
      title: c.title,
      currentType: c.currentType,
      currentConfidence: c.currentConfidence,
      reason: c.reason,
    })),
  };
}

/**
 * コスト見積もり（候補数を取得）
 */
async function estimateCost(payload: unknown) {
  const p = (payload ?? {}) as GetCandidatesPayload;
  const count = await countLlmInferenceCandidates({
    limit: p.limit,
    confidenceThreshold: p.confidenceThreshold,
  });

  return {
    candidateCount: count,
    estimatedCost: 0, // Ollamaはローカル実行なので$0
    estimatedTimeSeconds: count * 3, // 約3秒/件
    message: `${count}件のノートを推論予定（ローカル実行のためコスト$0）`,
  };
}

/**
 * 推論を実行
 */
async function execute(payload: unknown) {
  const p = (payload ?? {}) as ExecutePayload;
  return await executeLlmInference({
    noteIds: p.noteIds,
    limit: p.limit,
    dryRun: p.dryRun,
    model: p.model,
    seed: p.seed,
  });
}

/**
 * 保留中一覧を取得
 */
async function getPending(payload: unknown) {
  const p = (payload ?? {}) as GetPendingPayload;
  return await getPendingResults({
    limit: p.limit,
    offset: p.offset,
  });
}

/**
 * 確認推奨（auto_applied_notified）一覧を取得
 */
async function getAutoAppliedNotified(payload: unknown) {
  const p = (payload ?? {}) as GetPendingPayload;
  return await getAutoAppliedNotifiedResults({
    limit: p.limit,
    offset: p.offset,
  });
}

/**
 * 保留を承認
 */
async function approve(payload: unknown) {
  const p = payload as ApprovePayload;
  if (!p?.resultId) {
    return { success: false, message: "resultId is required" };
  }
  return await approveResult(p.resultId);
}

/**
 * 保留を却下
 */
async function reject(payload: unknown) {
  const p = payload as RejectPayload;
  if (!p?.resultId) {
    return { success: false, message: "resultId is required" };
  }
  return await rejectResult(p.resultId);
}

/**
 * 保留を上書き
 */
async function override(payload: unknown) {
  const p = payload as OverridePayload;
  if (!p?.resultId || !p?.type) {
    return { success: false, message: "resultId and type are required" };
  }
  return await overrideResult(p.resultId, p.type, p.reason);
}

/**
 * 週次サマリーを取得
 */
async function weeklySummary() {
  return await getWeeklySummary();
}

/**
 * Ollamaのヘルスチェック
 */
async function health() {
  return await checkOllamaHealth();
}

// ============================================================
// エクスポート
// ============================================================

export const llmInferenceDispatcher: Record<
  string,
  (payload: unknown) => Promise<unknown>
> = {
  getCandidates,
  estimateCost,
  execute,
  getPending,
  getAutoAppliedNotified,
  approve,
  reject,
  override,
  weeklySummary,
  health,
};
