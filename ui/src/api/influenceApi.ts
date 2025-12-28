import type { NoteInfluence, InfluenceEdge, SimilarNote } from '../types/influence'
import { sendCommand } from './commandClient'

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
