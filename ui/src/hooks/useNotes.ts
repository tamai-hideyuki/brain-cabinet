import { useState, useEffect } from 'react'
import type { Note, SearchMode } from '../types/note'
import { fetchNotes, searchNotes } from '../api/notesApi'

// ノートを更新日時優先、作成日時が新しい順にソート
const sortNotes = (notes: Note[]): Note[] => {
  return [...notes].sort((a, b) => {
    // 更新日時で比較（新しい順）
    if (b.updatedAt !== a.updatedAt) {
      return b.updatedAt - a.updatedAt
    }
    // 更新日時が同じ場合は作成日時で比較（新しい順）
    return b.createdAt - a.createdAt
  })
}

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
      setNotes(sortNotes(data))
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
      setNotes(sortNotes(data))
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
