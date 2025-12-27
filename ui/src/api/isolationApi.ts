import { sendCommand } from './commandClient'

export type IsolatedNote = {
  noteId: string
  title: string
  category: string | null
  clusterId: number | null
  isolationScore: number
  inDegree: number
  outDegree: number
  inWeight: number
  outWeight: number
  connectivity: number
  avgSimilarity: number
  maxSimilarity: number
  createdAt: number
  updatedAt: number
}

export type IsolationStats = {
  totalNotes: number
  avgConnectivity: number
  avgIsolationScore: number
  isolatedCount: number
  wellConnectedCount: number
  noEdgesCount: number
}

export type IntegrationSuggestion = {
  noteId: string
  title: string
  similarity: number
  reason: string
}

// 孤立ノートを検出
export const fetchIsolatedNotes = async (
  threshold = 0.7,
  limit = 10
): Promise<IsolatedNote[]> => {
  return sendCommand<IsolatedNote[]>('isolation.detect', {
    threshold,
    limit,
    includeSimilarity: false, // ダッシュボードでは軽量化のためfalse
  })
}

// 特定ノートの孤立度を取得
export const fetchIsolationScore = async (noteId: string): Promise<IsolatedNote> => {
  return sendCommand<IsolatedNote>('isolation.score', { noteId })
}

// 孤立度の統計情報を取得
export const fetchIsolationStats = async (threshold = 0.7): Promise<IsolationStats> => {
  return sendCommand<IsolationStats>('isolation.stats', { threshold })
}

// 統合提案を取得
export const fetchIntegrationSuggestions = async (
  noteId: string,
  limit = 5
): Promise<IntegrationSuggestion[]> => {
  return sendCommand<IntegrationSuggestion[]>('isolation.suggestions', { noteId, limit })
}
