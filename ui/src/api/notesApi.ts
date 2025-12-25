import type { Note, NoteHistory, SearchMode, PromotionCandidate } from '../types/note'
import { fetchWithAuth } from './client'

const API_BASE = '/api'

type CommandResponse<T> = {
  success: boolean
  action: string
  result: T
}

async function sendCommand<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  if (!res.ok) throw new Error(`Failed to execute ${action}`)
  const data: CommandResponse<T> = await res.json()
  if (!data.success) throw new Error(`Command ${action} failed`)
  return data.result
}

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
