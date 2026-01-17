/**
 * PTM (Personal Thinking Model) UI型定義
 */

export type ThinkingMode = 'exploration' | 'consolidation' | 'refactoring' | 'rest'

export type ThinkingSeason = 'deep_focus' | 'broad_search' | 'structuring' | 'balanced'

export type DriftState = 'stable' | 'overheat' | 'stagnation'

export type DriftTrend = 'rising' | 'falling' | 'flat'

/**
 * Drift Phase (v7.2)
 * - creation: 思考の拡大・新規探索（expansion, pivot）
 * - destruction: 思考の縮小・収束（contraction）
 * - neutral: 安定・横方向の移動（lateral, stable）
 */
export type DriftPhase = 'creation' | 'destruction' | 'neutral'

export type CoachAdvice = {
  today: string
  tomorrow: string
  balance: string
  warning: string | null
}

export type ClusterPersonaSummary = {
  clusterId: number
  keywords: string[]
  noteCount: number
  cohesion: number
  role: 'driver' | 'stabilizer' | 'bridge' | 'isolated'
  drift: {
    contribution: number
    trend: DriftTrend
  }
  influence: {
    hubness: number
    authority: number
  }
}

export type PtmSummary = {
  date: string
  mode: ThinkingMode
  season: ThinkingSeason
  state: DriftState
  growthAngle: number
  trend: DriftTrend
  dominantCluster: number | null
  topClusters: ClusterPersonaSummary[]
  coach: CoachAdvice
}
