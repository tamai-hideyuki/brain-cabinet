import { useState, useEffect } from 'preact/hooks'
import type { Note } from '../types/note'
import { fetchNote } from '../api/notesApi'

export const useNote = (id: string | undefined) => {
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
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

  return { note, loading, error }
}
