import type { Note, NoteHistory, SearchMode, PromotionCandidate } from '../types/note'
import { sendCommand } from './commandClient'

// note.list の結果型（バックエンドはsnippetを返すため別型で受け取る）
type NoteListItem = {
  id: string
  title: string
  category: string | null
  snippet: string
  updatedAt: number
  createdAt: number
}

type NoteListResult = {
  notes: NoteListItem[]
  total: number
}

// search.query の結果型（配列が直接返される）
type SearchQueryResult = Array<Note & { score: number }>

export const fetchNotes = async (): Promise<Note[]> => {
  const result = await sendCommand<NoteListResult>('note.list', { limit: 100 })
  // snippet を content に変換して Note 型に適合させる
  return result.notes.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.snippet, // snippet → content
    path: null,
    tags: [],
    category: n.category,
    clusterId: null,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }))
}

export const fetchNote = async (id: string): Promise<Note> => {
  return sendCommand<Note>('note.get', { id })
}

export const fetchNoteHistory = async (id: string): Promise<NoteHistory[]> => {
  const result = await sendCommand<{ histories: NoteHistory[] }>('note.history', { id })
  return result.histories
}

export const searchNotes = async (
  query: string,
  mode: SearchMode = 'keyword'
): Promise<Note[]> => {
  const result = await sendCommand<SearchQueryResult>('search.query', { query, mode })
  return result
}

// Promotion Candidates API
export const fetchPromotionCandidates = async (limit = 10): Promise<PromotionCandidate[]> => {
  return sendCommand<PromotionCandidate[]>('decision.promotionCandidates', { limit })
}

// Note Create API
export const createNote = async (title: string, content: string): Promise<Note> => {
  return sendCommand<Note>('note.create', { title, content })
}

// Note Update API
export const updateNote = async (id: string, title: string, content: string): Promise<Note> => {
  return sendCommand<Note>('note.update', { id, title, content })
}
