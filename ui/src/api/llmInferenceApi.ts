/**
 * LLM推論 API クライアント
 *
 * v6: Ollama + Qwen2.5:3b によるローカルLLM推論
 */

import { sendCommand } from './commandClient'
import type {
  GetCandidatesResult,
  LlmInferenceExecuteResult,
  GetPendingResult,
  WeeklySummary,
  OllamaHealthStatus,
  LlmInferenceActionResult,
} from '../types/llmInference'
import type { NoteType } from '../types/note'

// ============================================================
// 候補取得・コスト見積もり
// ============================================================

export type GetCandidatesParams = {
  limit?: number
  confidenceThreshold?: number
}

export async function getCandidates(
  params?: GetCandidatesParams
): Promise<GetCandidatesResult> {
  return sendCommand<GetCandidatesResult>('llmInference.getCandidates', params)
}

export type EstimateCostResult = {
  candidateCount: number
  estimatedCost: number
  estimatedTimeSeconds: number
  message: string
}

export async function estimateCost(
  params?: GetCandidatesParams
): Promise<EstimateCostResult> {
  return sendCommand<EstimateCostResult>('llmInference.estimateCost', params)
}

// ============================================================
// 推論実行
// ============================================================

export type ExecuteParams = {
  noteIds?: string[]
  limit?: number
  dryRun?: boolean
  model?: string
  seed?: number
}

export async function execute(
  params?: ExecuteParams
): Promise<LlmInferenceExecuteResult> {
  return sendCommand<LlmInferenceExecuteResult>('llmInference.execute', params)
}

// ============================================================
// 保留管理
// ============================================================

export type GetPendingParams = {
  limit?: number
  offset?: number
}

export async function getPending(
  params?: GetPendingParams
): Promise<GetPendingResult> {
  return sendCommand<GetPendingResult>('llmInference.getPending', params)
}

export async function approve(
  resultId: number
): Promise<LlmInferenceActionResult> {
  return sendCommand<LlmInferenceActionResult>('llmInference.approve', {
    resultId,
  })
}

export async function reject(
  resultId: number
): Promise<LlmInferenceActionResult> {
  return sendCommand<LlmInferenceActionResult>('llmInference.reject', {
    resultId,
  })
}

export type OverrideParams = {
  resultId: number
  type: NoteType
  reason?: string
}

export async function override(
  params: OverrideParams
): Promise<LlmInferenceActionResult> {
  return sendCommand<LlmInferenceActionResult>('llmInference.override', params)
}

// ============================================================
// サマリー・ヘルスチェック
// ============================================================

export async function getWeeklySummary(): Promise<WeeklySummary> {
  return sendCommand<WeeklySummary>('llmInference.weeklySummary')
}

export async function checkHealth(): Promise<OllamaHealthStatus> {
  return sendCommand<OllamaHealthStatus>('llmInference.health')
}
