/**
 * Drift API Client (v7.5)
 *
 * ドリフト（思考変化）関連のAPIクライアント
 * - drift.timeline: 日別ドリフトデータ（phase付き）
 * - drift.insight: ドリフトインサイト
 * - drift.summary: ドリフトサマリー
 */

import { sendCommand } from './commandClient'

/**
 * ドリフトフェーズ (v7.2)
 * - creation: 思考の拡大・新規探索
 * - destruction: 思考の縮小・収束
 * - neutral: 安定・横方向の移動
 */
export type DriftPhase = 'creation' | 'destruction' | 'neutral'

export type DriftState = 'stable' | 'overheat' | 'stagnation'
export type DriftTrend = 'rising' | 'falling' | 'flat'

/**
 * 日別ドリフトデータポイント
 */
export type DriftDayData = {
  date: string
  drift: number
  ema: number
  phase?: DriftPhase
  annotation?: {
    label: string
    note: string | null
  }
}

/**
 * ドリフトタイムラインサマリー
 */
export type DriftTimelineSummary = {
  todayDrift: number
  todayEMA: number
  state: DriftState
  trend: DriftTrend
  mean: number
  stdDev: number
}

/**
 * ドリフトタイムラインレスポンス
 */
export type DriftTimelineResponse = {
  range: string
  days: DriftDayData[]
  summary: DriftTimelineSummary
}

/**
 * ドリフトインサイトレスポンス
 */
export type DriftInsightResponse = {
  state: DriftState
  trend: DriftTrend
  description: string
  advice: string
  // 追加のメトリクス（あれば）
  metrics?: {
    growthAngle: number
    recentVolatility: number
  }
}

/**
 * ドリフトタイムラインを取得
 * @param rangeDays 取得する日数（デフォルト: 30）
 */
export async function fetchDriftTimeline(
  rangeDays: number = 30
): Promise<DriftTimelineResponse> {
  return sendCommand<DriftTimelineResponse>('drift.timeline', { rangeDays })
}

/**
 * ドリフトインサイトを取得
 * @param rangeDays 分析対象の日数（デフォルト: 30）
 */
export async function fetchDriftInsight(
  rangeDays: number = 30
): Promise<DriftInsightResponse> {
  return sendCommand<DriftInsightResponse>('drift.insight', { rangeDays })
}

/**
 * ドリフトサマリーを取得
 * @param rangeDays 分析対象の日数（デフォルト: 30）
 */
export async function fetchDriftSummary(
  rangeDays: number = 30
): Promise<{
  rangeDays: number
  dataPoints: number
  angle: number
  warning: string | null
  mode: string
}> {
  return sendCommand('drift.summary', { rangeDays })
}
