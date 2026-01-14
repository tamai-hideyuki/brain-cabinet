import { sendCommand } from './commandClient'

export type TableInfo = {
  name: string
  label: string
  rowCount: number
  size: number
}

export type StorageStats = {
  totalSize: number
  tables: TableInfo[]
}

export const fetchStorageStats = async (): Promise<StorageStats> => {
  return sendCommand<StorageStats>('system.storage')
}

// ============================================================
// Health Check API
// ============================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export type ComponentHealth = {
  status: HealthStatus
  latency?: number
  message: string
}

export type HealthCheckResult = {
  status: HealthStatus
  timestamp: string
  uptime: number
  checks: {
    database: ComponentHealth
    storage: {
      status: HealthStatus
      notesCount: number
      message: string
    }
  }
  gptSummary: string
}

export const fetchHealthCheck = async (): Promise<HealthCheckResult> => {
  return sendCommand<HealthCheckResult>('system.health')
}

// ============================================================
// Voice Evaluation API
// ============================================================

export type ClusterPersonaOutput = {
  clusterId: number
  name: string
  oneLiner: string
  persona: {
    identity: {
      observation: string
      voice: string
    }
    thinkingStyle: string
    motivation: string
    strength: string
    risk: string
    roleInGrowth: string
    currentState: {
      trend: string
      driftContribution: number
      cohesion: number
    }
    future: string
  }
}

export type DetectedExpression = {
  field: string
  text: string
  pattern: string
  isAllowed: boolean
}

export type EvaluationResult = {
  clusterId: number
  clusterName: string
  evaluatedAt: string
  promptVersion: string
  totalSentences: number
  assertionCount: number
  causalCount: number
  assertionRate: number
  causalRate: number
  structureSeparated: boolean
  detectedAssertions: DetectedExpression[]
  detectedCausals: DetectedExpression[]
  rawOutput: ClusterPersonaOutput
}

export type EvaluationListItem = {
  id: number
  clusterId: number
  clusterName: string
  promptVersion: string
  assertionRate: number
  causalRate: number
  structureSeparated: boolean
  createdAt: number
}

export type EvaluationSummary = {
  totalEvaluations: number
  avgAssertionRate: number
  avgCausalRate: number
  structureSeparationRate: number
}

/**
 * 人格化出力を評価して保存
 */
export const evaluateVoice = async (
  output: ClusterPersonaOutput,
  promptVersion?: string
): Promise<{ markdown: string; result: EvaluationResult }> => {
  return sendCommand('system.evaluateVoice', { output, promptVersion })
}

/**
 * 評価履歴を取得
 */
export const listVoiceEvaluations = async (
  limit?: number
): Promise<{ evaluations: EvaluationListItem[]; total: number }> => {
  return sendCommand('system.listVoiceEvaluations', { limit })
}

/**
 * 特定の評価詳細を取得
 */
export const getVoiceEvaluation = async (
  id: number
): Promise<{ id: number; markdown: string; result: EvaluationResult }> => {
  return sendCommand('system.getVoiceEvaluation', { id })
}

/**
 * 評価サマリーを取得
 */
export const getVoiceEvaluationSummary = async (): Promise<EvaluationSummary> => {
  return sendCommand('system.voiceEvaluationSummary')
}

/**
 * 評価履歴をクリア
 */
export const clearVoiceEvaluations = async (): Promise<{ message: string }> => {
  return sendCommand('system.clearVoiceEvaluations')
}
