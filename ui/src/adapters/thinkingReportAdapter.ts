/**
 * Thinking Report Adapter
 * API呼び出しと型変換を担当
 */

import {
  fetchWeeklyReport,
  fetchDistribution,
  generateClusterLabels,
  fetchClusterNotes,
  type WeeklyReport,
  type DistributionResponse,
  type ClusterNote,
} from '../api/thinkingReportApi'

// 型をre-export
export type { WeeklyReport, DistributionResponse, ClusterNote }

/**
 * 週次レポートを取得
 */
export const getWeeklyReport = async (date?: string): Promise<WeeklyReport> => {
  const res = await fetchWeeklyReport(date)
  return res.report
}

/**
 * 視点分布を取得
 */
export const getDistribution = async (
  period: 'week' | 'month' | 'all' = 'week'
): Promise<DistributionResponse> => {
  return fetchDistribution(period)
}

/**
 * クラスタラベルを自動生成
 */
export const generateLabels = async (
  force = false
): Promise<{ message: string; updated: number; failed: number }> => {
  const result = await generateClusterLabels(force)
  return {
    message: result.message,
    updated: result.updated,
    failed: result.failed,
  }
}

/**
 * 特定クラスタのノート一覧を取得
 */
export const getClusterNotes = async (identityId: number): Promise<ClusterNote[]> => {
  const res = await fetchClusterNotes(identityId)
  return res.notes
}
