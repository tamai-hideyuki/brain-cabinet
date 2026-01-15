import { useState, useEffect, useCallback } from 'react'
import * as clusterEvolutionAdapter from '../../adapters/clusterEvolutionAdapter'
import type {
  ClusterIdentity,
  IdentityTimelineEntry,
  SnapshotSummary,
  ClusterEvent,
} from '../../adapters/clusterEvolutionAdapter'

export const useClusterEvolution = () => {
  const [identities, setIdentities] = useState<ClusterIdentity[]>([])
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [selectedIdentityId, setSelectedIdentityId] = useState<number | null>(null)
  const [identityTimeline, setIdentityTimeline] = useState<IdentityTimelineEntry[]>([])
  const [snapshotEvents, setSnapshotEvents] = useState<Map<number, ClusterEvent[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'identities' | 'snapshots'>('identities')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [identitiesData, snapshotsData] = await Promise.all([
        clusterEvolutionAdapter.getIdentities(false),
        clusterEvolutionAdapter.getSnapshots(20),
      ])
      setIdentities(identitiesData)
      setSnapshots(snapshotsData)

      // 最初のアクティブなアイデンティティを選択
      const activeIdentity = identitiesData.find((i) => i.isActive)
      if (activeIdentity) {
        setSelectedIdentityId(activeIdentity.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (selectedIdentityId === null) return

    const loadTimeline = async () => {
      setTimelineLoading(true)
      try {
        const timeline = await clusterEvolutionAdapter.getIdentityTimeline(selectedIdentityId)
        setIdentityTimeline(timeline)
      } catch (e) {
        console.error('Failed to load timeline:', e)
      } finally {
        setTimelineLoading(false)
      }
    }
    loadTimeline()
  }, [selectedIdentityId])

  const selectIdentity = useCallback((identityId: number) => {
    setSelectedIdentityId(identityId)
  }, [])

  const loadSnapshotEvents = useCallback(async (snapshotId: number) => {
    if (snapshotEvents.has(snapshotId)) return

    try {
      const events = await clusterEvolutionAdapter.getSnapshotEvents(snapshotId)
      setSnapshotEvents((prev) => new Map(prev).set(snapshotId, events))
    } catch (e) {
      console.error('Failed to load events:', e)
    }
  }, [snapshotEvents])

  const getSnapshotEvents = useCallback((snapshotId: number): ClusterEvent[] | undefined => {
    return snapshotEvents.get(snapshotId)
  }, [snapshotEvents])

  const hasSnapshotEvents = useCallback((snapshotId: number): boolean => {
    return snapshotEvents.has(snapshotId)
  }, [snapshotEvents])

  const selectedIdentity = identities.find((i) => i.id === selectedIdentityId) ?? null

  return {
    identities,
    snapshots,
    selectedIdentity,
    selectedIdentityId,
    identityTimeline,
    loading,
    timelineLoading,
    error,
    tab,
    setTab,
    reload: loadData,
    selectIdentity,
    loadSnapshotEvents,
    getSnapshotEvents,
    hasSnapshotEvents,
  }
}
