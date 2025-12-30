import { useState, useEffect, useCallback } from 'react'
import type { Note, SearchMode } from '../../types/note'
import { fetchNotes, searchNotes } from '../../api/notesApi'

const PAGE_SIZE = 30

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

  // ページネーション用state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalNotes, setTotalNotes] = useState(0)

  const totalPages = Math.ceil(totalNotes / PAGE_SIZE)

  const loadNotes = useCallback(async (page: number = currentPage) => {
    setLoading(true)
    setError(null)
    try {
      const offset = (page - 1) * PAGE_SIZE
      const result = await fetchNotes({ limit: PAGE_SIZE, offset })
      setNotes(sortNotes(result.notes))
      setTotalNotes(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [currentPage])

  const executeSearch = async () => {
    if (!search.trim()) {
      setCurrentPage(1)
      loadNotes(1)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await searchNotes(search, searchMode)
      setNotes(sortNotes(data))
      setTotalNotes(data.length)
      setCurrentPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
    loadNotes(page)
  }

  useEffect(() => {
    loadNotes(1)
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
    reload: () => loadNotes(currentPage),
    // ページネーション
    currentPage,
    totalPages,
    totalNotes,
    goToPage,
  }
}
