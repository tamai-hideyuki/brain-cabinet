import type { NoteInfluence } from '../types/influence'
import { fetchWithAuth } from './client'

const API_BASE = '/api'

export const fetchNoteInfluence = async (noteId: string): Promise<NoteInfluence> => {
  const res = await fetchWithAuth(`${API_BASE}/influence/note/${noteId}?limit=10`)
  if (!res.ok) throw new Error('Failed to fetch note influence')
  return res.json()
}
