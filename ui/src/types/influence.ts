/**
 * Influence Graph UI型定義
 */

export type InfluenceEdge = {
  sourceNoteId: string
  targetNoteId: string
  weight: number
  cosineSim: number
  driftScore: number
  sourceNote?: {
    id: string
    title: string
    clusterId: number | null
  } | null
  targetNote?: {
    id: string
    title: string
    clusterId: number | null
  } | null
}

export type InfluenceSummary = {
  incomingEdges: number
  outgoingEdges: number
  totalIncomingInfluence: number
  totalOutgoingInfluence: number
}

export type NoteInfluence = {
  note: {
    id: string
    title: string
    clusterId: number | null
  } | null
  summary: InfluenceSummary
  influencers: InfluenceEdge[]
  influenced: InfluenceEdge[]
  similarNotes?: SimilarNote[]
}

export type SimilarNote = {
  noteId: string
  similarity: number
  note: {
    id: string
    title: string
    clusterId: number | null
  } | null
}
