import { useState, useEffect, useCallback } from 'react'
import * as systemAdapter from '../../adapters/systemAdapter'
import type {
  StorageStats,
  HealthCheckResult,
  EvaluationListItem,
  EvaluationSummary,
  MetricsSummary,
  V75Stats,
} from '../../adapters/systemAdapter'
import { useDataChangeSubscription } from '../useDataChangeSubscription'

export const useSystemInfo = () => {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [health, setHealth] = useState<HealthCheckResult | null>(null)
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)
  const [voiceEvaluations, setVoiceEvaluations] = useState<EvaluationListItem[]>([])
  const [voiceSummary, setVoiceSummary] = useState<EvaluationSummary | null>(null)
  const [v75Stats, setV75Stats] = useState<V75Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [storageData, metricsData, voiceData, summaryData, healthData, v75Data] = await Promise.all([
        systemAdapter.getStorageStats(),
        systemAdapter.getMetrics(),
        systemAdapter.getVoiceEvaluations(20),
        systemAdapter.getVoiceSummary(),
        systemAdapter.getHealth(),
        systemAdapter.getV75Stats().catch(() => null),
      ])
      setStats(storageData)
      setMetrics(metricsData)
      setVoiceEvaluations(voiceData.evaluations)
      setVoiceSummary(summaryData)
      setHealth(healthData)
      setV75Stats(v75Data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました')
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await loadData()
      setLoading(false)
    }
    load()
  }, [loadData])

  // データ変更時に自動更新（1秒デバウンス）
  useDataChangeSubscription(loadData, 1000)

  const refreshHealthCheck = useCallback(async () => {
    setHealthLoading(true)
    try {
      const healthData = await systemAdapter.getHealth()
      setHealth(healthData)
    } catch (e) {
      console.error('Health check failed:', e)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const resetMetrics = useCallback(async () => {
    await systemAdapter.resetMetrics()
    const metricsData = await systemAdapter.getMetrics()
    setMetrics(metricsData)
  }, [])

  const getVoiceEvaluationMarkdown = useCallback(async (id: number): Promise<string> => {
    try {
      const detail = await systemAdapter.getVoiceEvaluationDetail(id)
      return detail.markdown
    } catch (e) {
      setError(e instanceof Error ? e.message : '詳細取得に失敗しました')
      throw e
    }
  }, [])

  const resetVoiceEvaluations = useCallback(async () => {
    await systemAdapter.resetVoiceEvaluations()
    setVoiceEvaluations([])
    setVoiceSummary({ totalEvaluations: 0, avgAssertionRate: 0, avgCausalRate: 0, structureSeparationRate: 0 })
  }, [])

  return {
    stats,
    health,
    metrics,
    voiceEvaluations,
    voiceSummary,
    v75Stats,
    loading,
    healthLoading,
    error,
    reload: loadData,
    refreshHealthCheck,
    resetMetrics,
    getVoiceEvaluationMarkdown,
    resetVoiceEvaluations,
  }
}
