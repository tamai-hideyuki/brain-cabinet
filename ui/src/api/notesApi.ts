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

export type FetchNotesResult = {
  notes: Note[]
  total: number
  limit?: number
  offset?: number
}

export type FetchNotesOptions = {
  limit?: number
  offset?: number
}

export const fetchNotes = async (options: FetchNotesOptions = {}): Promise<FetchNotesResult> => {
  const { limit = 30, offset = 0 } = options
  // limit: 0 で全件取得
  const result = await sendCommand<NoteListResult>('note.list', { limit, offset })
  // snippet を content に変換して Note 型に適合させる
  const notes = result.notes.map((n) => ({
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
  return { notes, total: result.total, limit, offset }
}

export const fetchNote = async (id: string): Promise<Note> => {
  return sendCommand<Note>('note.get', { id })
}

export const fetchNoteHistory = async (id: string): Promise<NoteHistory[]> => {
  const result = await sendCommand<{ histories: NoteHistory[] }>('note.history', { id, includeContent: true })
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

// 削除済みノートの型
export type DeletedNote = {
  id: string
  title: string
  category: string | null
  deletedAt: number
  snippet: string
}

export type DeletedNotesResult = {
  total: number
  notes: DeletedNote[]
}

// 削除済みノート一覧を取得
export const fetchDeletedNotes = async (): Promise<DeletedNotesResult> => {
  return sendCommand<DeletedNotesResult>('note.listDeleted', {})
}

// 削除済みノートを復元
export const restoreNote = async (id: string): Promise<Note> => {
  return sendCommand<Note>('note.restore', { id })
}
