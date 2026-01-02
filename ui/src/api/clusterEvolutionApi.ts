/**
 * Cluster Evolution API クライアント
 * v7 時系列クラスタ追跡
 */

import { fetchWithAuth } from './client'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ============================================================
// Types
// ============================================================

export type SnapshotTrigger = 'significant_change' | 'scheduled' | 'manual' | 'initial'
export type ConfidenceLabel = 'high' | 'medium' | 'low' | 'none'
export type ClusterEventType = 'split' | 'merge' | 'extinct' | 'emerge' | 'continue'

export type SnapshotSummary = {
  id: number
  createdAt: number
  trigger: SnapshotTrigger
  k: number
  totalNotes: number
  avgCohesion: number | null
  isCurrent: boolean
  changeScore: number | null
  notesAdded: number
  notesRemoved: number
  clusterCount: number
}

export type ClusterInfo = {
  id: number
  localId: number
  size: number
  sampleNoteId: string | null
  cohesion: number | null
  identityId: number | null
}

export type ClusterEvent = {
  id: number
  eventType: ClusterEventType
  createdAt: number
  details: Record<string, unknown>
}

export type ClusterIdentity = {
  id: number
  createdAt: number
  label: string | null
  description: string | null
  isActive: boolean
  lastSeenSnapshotId: number | null
}

export type IdentityTimelineEntry = {
  snapshotId: number
  snapshotCreatedAt: number
  clusterId: number
  size: number
  cohesion: number | null
}

export type ClusterTimelineEntry = {
  snapshotId: number
  snapshotCreatedAt: number
  cluster: ClusterInfo
  similarity: number
  confidenceLabel: ConfidenceLabel
}

// ============================================================
// API Functions
// ============================================================

/**
 * スナップショット一覧を取得
 */
export const fetchSnapshots = async (limit: number = 50): Promise<{
  snapshots: SnapshotSummary[]
  count: number
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/cluster-evolution/snapshots?limit=${limit}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch snapshots: ${res.status}`)
  }
  return res.json()
}

/**
 * 現在のスナップショットを取得
 */
export const fetchCurrentSnapshot = async (): Promise<{
  snapshot: Omit<SnapshotSummary, 'clusterCount'>
  clusters: ClusterInfo[]
} | null> => {
  const res = await fetchWithAuth(`${API_BASE}/api/cluster-evolution/snapshots/current`)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch current snapshot: ${res.status}`)
  }
  return res.json()
}

/**
 * スナップショットのイベント一覧を取得
 */
export const fetchSnapshotEvents = async (snapshotId: number): Promise<{
  snapshotId: number
  events: ClusterEvent[]
  count: number
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/cluster-evolution/snapshots/${snapshotId}/events`)
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status}`)
  }
  return res.json()
}

/**
 * クラスタアイデンティティ一覧を取得
 */
export const fetchIdentities = async (activeOnly: boolean = false): Promise<{
  identities: ClusterIdentity[]
  count: number
}> => {
  const url = activeOnly
    ? `${API_BASE}/api/cluster-evolution/identities?activeOnly=true`
    : `${API_BASE}/api/cluster-evolution/identities`
  const res = await fetchWithAuth(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch identities: ${res.status}`)
  }
  return res.json()
}

/**
 * アイデンティティのタイムラインを取得
 */
export const fetchIdentityTimeline = async (identityId: number): Promise<{
  identityId: number
  timeline: IdentityTimelineEntry[]
  count: number
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/cluster-evolution/identities/${identityId}/timeline`)
  if (!res.ok) {
    throw new Error(`Failed to fetch identity timeline: ${res.status}`)
  }
  return res.json()
}

/**
 * アイデンティティにラベルを設定
 */
export const updateIdentityLabel = async (
  identityId: number,
  label: string,
  description?: string
): Promise<{
  success: boolean
  identityId: number
  label: string
  description: string | null
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/cluster-evolution/identities/${identityId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, description }),
  })
  if (!res.ok) {
    throw new Error(`Failed to update identity label: ${res.status}`)
  }
  return res.json()
}

/**
 * クラスタのタイムライン（系譜）を取得
 */
export const fetchClusterTimeline = async (
  clusterId: number,
  depth: number = 20
): Promise<{
  clusterId: number
  timeline: ClusterTimelineEntry[]
  depth: number
}> => {
  const res = await fetchWithAuth(`${API_BASE}/api/cluster-evolution/clusters/${clusterId}/timeline?depth=${depth}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch cluster timeline: ${res.status}`)
  }
  return res.json()
}
