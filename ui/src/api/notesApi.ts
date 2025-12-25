import type { Note, NoteHistory, SearchMode, PromotionCandidate } from '../types/note'
import { fetchWithAuth } from './client'
import { sendCommand } from './commandClient'

const API_BASE = '/api'

export const fetchNotes = async (): Promise<Note[]> => {
  const res = await fetchWithAuth(`${API_BASE}/notes`)
  if (!res.ok) throw new Error('Failed to fetch notes')
  return res.json()
}

export const fetchNote = async (id: string): Promise<Note> => {
  const res = await fetchWithAuth(`${API_BASE}/notes/${id}`)
  if (!res.ok) throw new Error('Failed to fetch note')
  return res.json()
}

export const fetchNoteHistory = async (id: string): Promise<NoteHistory[]> => {
  const res = await fetchWithAuth(`${API_BASE}/notes/${id}/history`)
  if (!res.ok) throw new Error('Failed to fetch note history')
  return res.json()
}

type SearchResultItem = Note & { score: number }

export const searchNotes = async (
  query: string,
  mode: SearchMode = 'keyword'
): Promise<Note[]> => {
  const params = new URLSearchParams({ query, mode })
  const res = await fetchWithAuth(`${API_BASE}/search?${params}`)
  if (!res.ok) throw new Error('Failed to search notes')
  const data: SearchResultItem[] = await res.json()
  return data
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
