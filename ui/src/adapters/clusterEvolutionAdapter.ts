/**
 * Cluster Evolution Adapter
 * API呼び出しと型変換を担当
 */

import {
  fetchIdentities,
  fetchIdentityTimeline,
  fetchSnapshots,
  fetchSnapshotEvents,
  type ClusterIdentity,
  type IdentityTimelineEntry,
  type SnapshotSummary,
  type ClusterEvent,
} from '../api/clusterEvolutionApi'

// 型をre-export
export type { ClusterIdentity, IdentityTimelineEntry, SnapshotSummary, ClusterEvent }

/**
 * クラスタアイデンティティ一覧を取得
 */
export const getIdentities = async (
  activeOnly = false
): Promise<ClusterIdentity[]> => {
  const result = await fetchIdentities(activeOnly)
  return result.identities
}

/**
 * スナップショット一覧を取得
 */
export const getSnapshots = async (limit = 20): Promise<SnapshotSummary[]> => {
  const result = await fetchSnapshots(limit)
  return result.snapshots
}

/**
 * アイデンティティのタイムラインを取得
 */
export const getIdentityTimeline = async (
  identityId: number
): Promise<IdentityTimelineEntry[]> => {
  const result = await fetchIdentityTimeline(identityId)
  return result.timeline
}

/**
 * スナップショットのイベント一覧を取得
 */
export const getSnapshotEvents = async (
  snapshotId: number
): Promise<ClusterEvent[]> => {
  const result = await fetchSnapshotEvents(snapshotId)
  return result.events
}
