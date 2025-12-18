import { useState, useEffect } from 'preact/hooks'
import type { Note, SearchMode } from '../types/note'
import { fetchNotes, searchNotes } from '../api/notesApi'

export const useNotes = () => {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword')

  const loadNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNotes()
      setNotes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const executeSearch = async () => {
    if (!search.trim()) {
      loadNotes()
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await searchNotes(search, searchMode)
      setNotes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
  }, [])

  return {
    notes,
    loading,
    error,
    search,
    setSearch,
    searchMode,
    setSearchMode,
    executeSearch,
    reload: loadNotes,
  }
}
