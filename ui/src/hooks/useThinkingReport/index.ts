import { useState, useEffect, useCallback } from 'react'
import * as thinkingReportAdapter from '../../adapters/thinkingReportAdapter'
import type { WeeklyReport, DistributionResponse, ClusterNote } from '../../adapters/thinkingReportAdapter'

export const useThinkingReport = () => {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [distribution, setDistribution] = useState<DistributionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [labelGenerating, setLabelGenerating] = useState(false)
  const [labelMessage, setLabelMessage] = useState<string | null>(null)
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set())
  const [clusterNotes, setClusterNotes] = useState<Record<string, ClusterNote[]>>({})
  const [loadingClusters, setLoadingClusters] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [reportData, distRes] = await Promise.all([
        thinkingReportAdapter.getWeeklyReport(),
        thinkingReportAdapter.getDistribution('week'),
      ])

      setReport(reportData)
      setDistribution(distRes)
    } catch (err) {
      console.error('Failed to load thinking report:', err)
      setError(err instanceof Error ? err.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const generateLabels = useCallback(async (force = false) => {
    try {
      setLabelGenerating(true)
      setLabelMessage(null)
      const result = await thinkingReportAdapter.generateLabels(force)
      setLabelMessage(result.message)
      // リロードしてラベルを反映
      const [reportData, distRes] = await Promise.all([
        thinkingReportAdapter.getWeeklyReport(),
        thinkingReportAdapter.getDistribution('week'),
      ])
      setReport(reportData)
      setDistribution(distRes)
    } catch (err) {
      setLabelMessage(err instanceof Error ? err.message : 'ラベル生成に失敗しました')
    } finally {
      setLabelGenerating(false)
    }
  }, [])

  const toggleClusterExpand = useCallback(async (clusterKey: string, identityId: number) => {
    const newExpanded = new Set(expandedClusters)

    if (newExpanded.has(clusterKey)) {
      newExpanded.delete(clusterKey)
      setExpandedClusters(newExpanded)
      return
    }

    // 展開時にノートを取得
    newExpanded.add(clusterKey)
    setExpandedClusters(newExpanded)

    // 既にノートがある場合はスキップ
    if (clusterNotes[clusterKey]) return

    // ノート取得
    const newLoading = new Set(loadingClusters)
    newLoading.add(clusterKey)
    setLoadingClusters(newLoading)

    try {
      const notes = await thinkingReportAdapter.getClusterNotes(identityId)
      setClusterNotes((prev) => ({ ...prev, [clusterKey]: notes }))
    } catch (err) {
      console.error('Failed to fetch cluster notes:', err)
    } finally {
      setLoadingClusters((prev) => {
        const next = new Set(prev)
        next.delete(clusterKey)
        return next
      })
    }
  }, [expandedClusters, clusterNotes, loadingClusters])

  const isClusterExpanded = useCallback((clusterKey: string) => {
    return expandedClusters.has(clusterKey)
  }, [expandedClusters])

  const isClusterLoading = useCallback((clusterKey: string) => {
    return loadingClusters.has(clusterKey)
  }, [loadingClusters])

  const getClusterNotes = useCallback((clusterKey: string) => {
    return clusterNotes[clusterKey] || []
  }, [clusterNotes])

  return {
    report,
    distribution,
    loading,
    error,
    labelGenerating,
    labelMessage,
    reload: loadData,
    generateLabels,
    toggleClusterExpand,
    isClusterExpanded,
    isClusterLoading,
    getClusterNotes,
  }
}
