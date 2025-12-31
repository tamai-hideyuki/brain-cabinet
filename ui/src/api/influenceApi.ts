import type { NoteInfluence, InfluenceEdge, SimilarNote } from '../types/influence'
import { sendCommand } from './commandClient'
import { fetchWithAuth } from './client'

const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * 影響サマリーのノート情報
 */
export type InfluenceSummaryNote = {
  noteId: string
  title: string
  clusterId: number | null
  edgeCount: number
  totalInfluence: number
}

/**
 * 影響サマリー レスポンス
 */
export type InfluenceSummary = {
  overview: {
    totalEdges: number
    avgWeight: number
    maxWeight: number
  }
  topInfluenced: InfluenceSummaryNote[]
  topInfluencers: InfluenceSummaryNote[]
  insight: string
}

/**
 * 影響グラフのサマリーを取得
 */
export const fetchInfluenceSummary = async (): Promise<InfluenceSummary> => {
  const res = await fetchWithAuth(`${API_BASE}/api/influence/summary`)
  if (!res.ok) {
    throw new Error(`Failed to fetch influence summary: ${res.status}`)
  }
  return res.json()
}

type NoteInfo = {
  id: string
  title: string
  clusterId: number | null
}

export const fetchNoteInfluence = async (noteId: string): Promise<NoteInfluence> => {
  // influence.influencers, influence.influenced, note.get を並行して取得
  const [influencersResult, influencedResult, noteResult] = await Promise.all([
    sendCommand<InfluenceEdge[]>('influence.influencers', { noteId, limit: 10 }),
    sendCommand<InfluenceEdge[]>('influence.influenced', { noteId, limit: 10 }),
    sendCommand<NoteInfo>('note.get', { id: noteId }).catch(() => null),
  ])

  // summary を計算
  const totalIncomingInfluence = influencersResult.reduce((sum, e) => sum + e.weight, 0)
  const totalOutgoingInfluence = influencedResult.reduce((sum, e) => sum + e.weight, 0)

  // 影響エッジがない場合、類似ノートを取得
  let similarNotes: SimilarNote[] | undefined
  if (influencersResult.length === 0 && influencedResult.length === 0) {
    try {
      similarNotes = await sendCommand<SimilarNote[]>('influence.similar', { noteId, limit: 5 })
    } catch {
      similarNotes = []
    }
  }

  return {
    note: noteResult ? { id: noteResult.id, title: noteResult.title, clusterId: noteResult.clusterId } : null,
    summary: {
      incomingEdges: influencersResult.length,
      outgoingEdges: influencedResult.length,
      totalIncomingInfluence: Math.round(totalIncomingInfluence * 10000) / 10000,
      totalOutgoingInfluence: Math.round(totalOutgoingInfluence * 10000) / 10000,
    },
    influencers: influencersResult,
    influenced: influencedResult,
    similarNotes,
  }
}
