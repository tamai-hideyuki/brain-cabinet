import { useState, useEffect, useCallback } from 'react'
import type { NoteInfluence } from '../../types/influence'
import { fetchNoteInfluence } from '../../api/influenceApi'

export const useNoteInfluence = (noteId: string | null) => {
  const [influence, setInfluence] = useState<NoteInfluence | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInfluence = useCallback(async () => {
    if (!noteId) return

    setLoading(true)
    setError(null)
    try {
      const data = await fetchNoteInfluence(noteId)
      setInfluence(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    loadInfluence()
  }, [loadInfluence])

  return {
    influence,
    loading,
    error,
    reload: loadInfluence,
  }
}
