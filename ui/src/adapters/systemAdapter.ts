/**
 * System Adapter
 * API呼び出しと型変換を担当
 */

import {
  fetchStorageStats,
  fetchHealthCheck,
  listVoiceEvaluations,
  getVoiceEvaluation,
  getVoiceEvaluationSummary,
  clearVoiceEvaluations,
  type StorageStats,
  type HealthCheckResult,
  type EvaluationListItem,
  type EvaluationSummary,
} from '../api/systemApi'
import {
  getMetricsSummary,
  clearMetrics,
  type MetricsSummary,
} from '../stores/metricsStore'
import {
  getDriftTimeline,
  getPhaseCounts,
  type DriftPhase,
} from './driftAdapter'

// 型をre-export
export type {
  StorageStats,
  HealthCheckResult,
  EvaluationListItem,
  EvaluationSummary,
  MetricsSummary,
}

// v7.5 統計型
export type V75Stats = {
  drift: {
    totalDays: number
    phaseCounts: Record<DriftPhase, number>
    todayPhase: DriftPhase | null
    averageDrift: number
    currentEma: number
  }
  personalization: {
    evaluatedClusters: number
    avgAssertionRate: number
    avgCausalRate: number
  }
}

/**
 * ストレージ統計を取得
 */
export const getStorageStats = async (): Promise<StorageStats> => {
  return fetchStorageStats()
}

/**
 * ヘルスチェック結果を取得
 */
export const getHealth = async (): Promise<HealthCheckResult> => {
  return fetchHealthCheck()
}

/**
 * メトリクスサマリーを取得
 */
export const getMetrics = async (): Promise<MetricsSummary> => {
  return getMetricsSummary()
}

/**
 * メトリクスをクリア
 */
export const resetMetrics = async (): Promise<void> => {
  await clearMetrics()
}

/**
 * Voice評価一覧を取得
 */
export const getVoiceEvaluations = async (
  limit?: number
): Promise<{ evaluations: EvaluationListItem[]; total: number }> => {
  return listVoiceEvaluations(limit)
}

/**
 * Voice評価詳細のMarkdownを取得
 */
export const getVoiceEvaluationDetail = async (
  id: number
): Promise<{ id: number; markdown: string }> => {
  const detail = await getVoiceEvaluation(id)
  return { id: detail.id, markdown: detail.markdown }
}

/**
 * Voice評価サマリーを取得
 */
export const getVoiceSummary = async (): Promise<EvaluationSummary> => {
  return getVoiceEvaluationSummary()
}

/**
 * Voice評価をクリア
 */
export const resetVoiceEvaluations = async (): Promise<void> => {
  await clearVoiceEvaluations()
}

/**
 * v7.5 統計を取得
 */
export const getV75Stats = async (): Promise<V75Stats> => {
  const [driftData, voiceSummary] = await Promise.all([
    getDriftTimeline(30),
    getVoiceEvaluationSummary(),
  ])

  const phaseCounts = getPhaseCounts(driftData.days)
  const todayPhase = driftData.days.length > 0
    ? driftData.days[driftData.days.length - 1].phase ?? null
    : null

  return {
    drift: {
      totalDays: driftData.days.length,
      phaseCounts,
      todayPhase,
      averageDrift: driftData.summary.mean,
      currentEma: driftData.summary.todayEMA,
    },
    personalization: {
      evaluatedClusters: voiceSummary.totalEvaluations,
      avgAssertionRate: voiceSummary.avgAssertionRate,
      avgCausalRate: voiceSummary.avgCausalRate,
    },
  }
}
