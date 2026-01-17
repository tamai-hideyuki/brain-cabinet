/**
 * Drift Adapter (v7.5)
 * API呼び出しと型変換を担当
 */

import {
  fetchDriftTimeline,
  fetchDriftInsight,
  fetchDriftSummary,
  type DriftTimelineResponse,
  type DriftInsightResponse,
  type DriftDayData,
  type DriftPhase,
  type DriftState,
  type DriftTrend,
} from '../api/driftApi'

// 型をre-export
export type {
  DriftTimelineResponse,
  DriftInsightResponse,
  DriftDayData,
  DriftPhase,
  DriftState,
  DriftTrend,
}

/**
 * ドリフトタイムラインを取得
 */
export const getDriftTimeline = async (
  rangeDays = 30
): Promise<DriftTimelineResponse> => {
  return fetchDriftTimeline(rangeDays)
}

/**
 * ドリフトインサイトを取得
 */
export const getDriftInsight = async (
  rangeDays = 30
): Promise<DriftInsightResponse> => {
  return fetchDriftInsight(rangeDays)
}

/**
 * ドリフトサマリーを取得
 */
export const getDriftSummary = async (rangeDays = 30) => {
  return fetchDriftSummary(rangeDays)
}

/**
 * フェーズ別の日数を集計
 */
export const getPhaseCounts = (
  days: DriftDayData[]
): Record<DriftPhase, number> => {
  return days.reduce(
    (acc, d) => {
      const phase = d.phase ?? 'neutral'
      acc[phase] = (acc[phase] || 0) + 1
      return acc
    },
    { creation: 0, destruction: 0, neutral: 0 } as Record<DriftPhase, number>
  )
}

/**
 * フェーズのラベルを取得
 */
export const getPhaseLabel = (phase: DriftPhase): string => {
  const labels: Record<DriftPhase, string> = {
    creation: '創造',
    destruction: '収束',
    neutral: '安定',
  }
  return labels[phase]
}

/**
 * フェーズのアイコンを取得
 */
export const getPhaseIcon = (phase: DriftPhase): string => {
  const icons: Record<DriftPhase, string> = {
    creation: '🌱',
    destruction: '🔥',
    neutral: '⚖️',
  }
  return icons[phase]
}

/**
 * フェーズの説明を取得
 */
export const getPhaseDescription = (phase: DriftPhase): string => {
  const descriptions: Record<DriftPhase, string> = {
    creation: '思考が拡大・新しい探索が活発',
    destruction: '思考が収束・整理フェーズ',
    neutral: '思考が安定・横方向の展開',
  }
  return descriptions[phase]
}

/**
 * 状態のラベルを取得
 */
export const getStateLabel = (state: DriftState): string => {
  const labels: Record<DriftState, string> = {
    stable: '安定',
    overheat: '過熱',
    stagnation: '停滞',
  }
  return labels[state]
}

/**
 * トレンドのアイコンを取得
 */
export const getTrendIcon = (trend: DriftTrend): string => {
  const icons: Record<DriftTrend, string> = {
    rising: '↗',
    falling: '↘',
    flat: '→',
  }
  return icons[trend]
}

/**
 * トレンドのラベルを取得
 */
export const getTrendLabel = (trend: DriftTrend): string => {
  const labels: Record<DriftTrend, string> = {
    rising: '上昇',
    falling: '下降',
    flat: '横ばい',
  }
  return labels[trend]
}
