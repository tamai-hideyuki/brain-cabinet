import { useState, useEffect } from 'react'
import type { Note, NoteHistory } from '../types/note'
import { fetchNote, fetchNoteHistory } from '../api/notesApi'

export const useNote = (id: string | undefined) => {
  const [note, setNote] = useState<Note | null>(null)
  const [history, setHistory] = useState<NoteHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchNote(id)
        setNote(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  const loadHistory = async () => {
    if (!id) return
    setHistoryLoading(true)
    try {
      const data = await fetchNoteHistory(id)
      setHistory(data)
    } catch (e) {
      console.error('Failed to load history:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  return { note, history, loading, historyLoading, error, loadHistory }
}
