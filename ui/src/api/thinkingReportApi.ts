/**
 * Thinking Report API クライアント
 * 思考成長レポート機能
 */

import { fetchWithAuth } from './client'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ============================================================
// Types
// ============================================================

export type Perspective = 'engineer' | 'po' | 'user' | 'cto' | 'team' | 'stakeholder'

export type ThinkingPhase = 'exploration' | 'structuring' | 'implementation' | 'reflection'

export type PerspectiveInfo = {
  id: Perspective
  label: string
}

export type PerspectiveQuestion = {
  perspective: Perspective
  perspectiveLabel: string
  question: string
}

export type PerspectiveDistributionItem = {
  perspective: Perspective
  perspectiveLabel: string
  percentage: number
  count?: number
}

export type ClusterGrowth = {
  identityId: number
  label: string | null
  notesDelta: number
  cohesionDelta: number
  currentSize: number
  currentCohesion: number | null
}

export type EventSummary = {
  type: 'split' | 'merge' | 'extinct' | 'emerge' | 'continue'
  count: number
  details: unknown[]
}

export type WeeklyChallenge = {
  perspective: Perspective
  perspectiveLabel: string
  question: string
  reason: string
}

export type WeeklyReport = {
  period: {
    start: number
    end: number
  }
  forest: {
    phase: {
      current: ThinkingPhase
      transition: { from: ThinkingPhase | null; to: ThinkingPhase } | null
    }
    bias: {
      category: string
      percentage: number
      message: string
    } | null
    blindSpots: Array<{
      identityLabel: string
      daysSinceLastUpdate: number
    }>
    metrics: {
      totalNotes: number
      notesAdded: number
      avgCohesion: number | null
      changeScore: number | null
    }
  }
  trees: {
    topGrowth: ClusterGrowth[]
    events: EventSummary[]
    newThoughts: Array<{
      identityId: number
      label: string | null
      size: number
      sampleTitle: string | null
    }>
    extinctThoughts: Array<{
      label: string | null
      absorbedBy: string | null
      size: number
      sampleTitle: string | null
    }>
  }
  perspectiveQuestions: PerspectiveQuestion[]
  perspectiveDistribution: PerspectiveDistributionItem[] | null
  weeklyChallenge: WeeklyChallenge | null
}

export type DistributionResponse = {
  success: boolean
  hasData: boolean
  period: string
  total: number
  withPerspective: number
  withoutPerspective: number
  tagRate: number
  distribution: PerspectiveDistributionItem[]
  message?: string
}

export type ChallengeProgress = {
  weekStart: number
  targetPerspective: Perspective
  perspectiveLabel: string
  targetCount: number
  achievedCount: number
  isCompleted: boolean
}

export type ClusterNote = {
  id: string
  title: string
  createdAt: number
}

export type ClusterNotesResponse = {
  success: boolean
  identityId: number
  notes: ClusterNote[]
  total: number
}

// ============================================================
// API Functions
// ============================================================

/**
 * 週次レポートを取得
 */
export const fetchWeeklyReport = async (date?: string): Promise<{
  success: boolean
  report: WeeklyReport
}> => {
  const url = date
    ? `${API_BASE}/api/thinking-report/weekly?date=${date}`
    : `${API_BASE}/api/thinking-report/weekly`
  const res = await fetchWithAuth(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch weekly report: ${res.status}`)
  }
  return res.json()
}

/**
 * 視点一覧を取得
 */
export const fetchPerspectives = async (): Promise<{
  perspectives: PerspectiveInfo[]
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/perspectives`)
  if (!res.ok) {
    throw new Error(`Failed to fetch perspectives: ${res.status}`)
  }
  return res.json()
}

/**
 * 視点別ガイド質問を取得
 */
export const fetchPerspectiveGuide = async (perspectiveId: Perspective): Promise<{
  perspective: Perspective
  perspectiveLabel: string
  guideQuestions: string[]
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/perspectives/${perspectiveId}/guide`)
  if (!res.ok) {
    throw new Error(`Failed to fetch perspective guide: ${res.status}`)
  }
  return res.json()
}

/**
 * 視点分布を取得
 */
export const fetchDistribution = async (period: 'week' | 'month' | 'all' = 'week'): Promise<DistributionResponse> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/distribution?period=${period}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch distribution: ${res.status}`)
  }
  return res.json()
}

/**
 * チャレンジ進捗を取得
 */
export const fetchChallengeProgress = async (): Promise<ChallengeProgress> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/challenge/progress`)
  if (!res.ok) {
    throw new Error(`Failed to fetch challenge progress: ${res.status}`)
  }
  return res.json()
}

/**
 * マイグレーションを実行
 */
export const runMigration = async (): Promise<{
  success: boolean
  message: string
  migrated: boolean
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/migrate`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`Failed to run migration: ${res.status}`)
  }
  return res.json()
}

/**
 * ノートの視点を更新
 */
export const updateNotePerspective = async (
  noteId: string,
  perspective: Perspective | null
): Promise<{
  message: string
  note: unknown
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/notes/${noteId}/perspective`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ perspective }),
  })
  if (!res.ok) {
    throw new Error(`Failed to update note perspective: ${res.status}`)
  }
  return res.json()
}

/**
 * 全クラスタのラベルを自動生成
 * @param force - trueの場合、既存ラベルも再生成
 */
export const generateClusterLabels = async (force = false): Promise<{
  success: boolean
  message: string
  updated: number
  failed: number
}> => {
  const url = force
    ? `${API_BASE}/api/thinking-report/labels/generate?force=true`
    : `${API_BASE}/api/thinking-report/labels/generate`
  const res = await fetchWithAuth(url, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`Failed to generate cluster labels: ${res.status}`)
  }
  return res.json()
}

/**
 * 特定クラスタのラベルを再生成
 */
export const regenerateClusterLabel = async (identityId: number): Promise<{
  success: boolean
  identityId: number
  label: string
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/labels/${identityId}/regenerate`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`Failed to regenerate cluster label: ${res.status}`)
  }
  return res.json()
}

/**
 * 特定クラスタに属するノート一覧を取得
 */
export const fetchClusterNotes = async (identityId: number): Promise<ClusterNotesResponse> => {
  const res = await fetchWithAuth(`${API_BASE}/api/thinking-report/clusters/${identityId}/notes`)
  if (!res.ok) {
    throw new Error(`Failed to fetch cluster notes: ${res.status}`)
  }
  return res.json()
}
