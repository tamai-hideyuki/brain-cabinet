/**
 * Isolation Adapter
 * API呼び出しと型変換を担当
 */

import {
  fetchIsolatedNotes,
  fetchIsolationStats,
  fetchIntegrationSuggestions,
  type IsolatedNote,
  type IsolationStats,
  type IntegrationSuggestion,
} from '../api/isolationApi'

// 型をre-export
export type { IsolatedNote, IsolationStats, IntegrationSuggestion }

/**
 * 孤立ノート一覧を取得
 */
export const getIsolatedNotes = async (
  threshold = 0.7,
  limit = 50
): Promise<IsolatedNote[]> => {
  return fetchIsolatedNotes(threshold, limit)
}

/**
 * 孤立度の統計情報を取得
 */
export const getStats = async (threshold = 0.7): Promise<IsolationStats> => {
  return fetchIsolationStats(threshold)
}

/**
 * 統合提案を取得
 */
export const getSuggestions = async (
  noteId: string,
  limit = 5
): Promise<IntegrationSuggestion[]> => {
  return fetchIntegrationSuggestions(noteId, limit)
}
