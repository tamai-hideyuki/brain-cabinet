/**
 * Analytics API クライアント
 */

import { fetchWithAuth } from './client'

const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * セマンティック差分の時系列データポイント（API生データ）
 */
type TimelinePointRaw = {
  date: string
  totalSemanticDiff: number
  changeCount: number
}

/**
 * セマンティック差分の時系列データポイント（UI用に変換後）
 */
export type SemanticDiffDataPoint = {
  date: string
  avgSemanticDiff: number
  noteCount: number
}

/**
 * セマンティック差分タイムライン レスポンス（API生データ）
 */
type SemanticDiffTimelineRaw = {
  range: string
  startDate: string
  endDate: string
  data: TimelinePointRaw[]
}

/**
 * セマンティック差分タイムライン レスポンス（UI用）
 */
export type SemanticDiffTimeline = {
  range: string
  startDate: string
  endDate: string
  data: SemanticDiffDataPoint[]
}

/**
 * セマンティック差分のタイムラインを取得
 * @param range 期間（例: "7d", "30d"）
 */
export const fetchSemanticDiffTimeline = async (
  range: string = '7d'
): Promise<SemanticDiffTimeline> => {
  const res = await fetchWithAuth(`${API_BASE}/api/analytics/timeline?range=${range}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch timeline: ${res.status}`)
  }
  const raw: SemanticDiffTimelineRaw = await res.json()

  // API形式からUI形式に変換
  return {
    range: raw.range,
    startDate: raw.startDate,
    endDate: raw.endDate,
    data: raw.data.map((point) => ({
      date: point.date,
      avgSemanticDiff: point.changeCount > 0 ? point.totalSemanticDiff / point.changeCount : 0,
      noteCount: point.changeCount,
    })),
  }
}

/**
 * サマリー統計
 */
export type AnalyticsSummary = {
  totalNotes: number
  avgSemanticDiff: number
  totalClusters: number
  lastUpdated: string
}

/**
 * サマリー統計を取得
 */
export const fetchAnalyticsSummary = async (): Promise<AnalyticsSummary> => {
  const res = await fetchWithAuth(`${API_BASE}/api/analytics/summary`)
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: ${res.status}`)
  }
  return res.json()
}
