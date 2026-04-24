import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword')
  const [totalNotes, setTotalNotes] = useState(0)

  // sessionStorageから復元するページ番号（初回マウント時のみ読み取る）
  const [restoredPage] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('notesListPage')
    if (saved) {
      sessionStorage.removeItem('notesListPage')
      const page = parseInt(saved, 10)
      if (page > 1) return page
    }
    return null
  })

  // URLからページ番号を取得、sessionStorageの復元値をフォールバック
  const urlPage = parseInt(searchParams.get('page') || '', 10)
  const currentPage = urlPage >= 1
    ? urlPage
    : (restoredPage ?? 1)
  const totalPages = Math.ceil(totalNotes / PAGE_SIZE)

  const loadNotes = useCallback(async (page: number) => {
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
  }, [])

  const executeSearch = async () => {
    if (!search.trim()) {
      setSearchParams({})
      loadNotes(1)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await searchNotes(search, searchMode)
      // バックエンドが検索スコア順で返すので、ここで並べ替えない（日付順にすると関連度を破壊する）
      setNotes(data)
      setTotalNotes(data.length)
      setSearchParams({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return
    // URLパラメータを更新（page=1の場合はパラメータを削除）
    if (page === 1) {
      setSearchParams({})
    } else {
      setSearchParams({ page: String(page) })
    }
    loadNotes(page)
  }

  // sessionStorageから復元した場合、URLパラメータを同期
  useEffect(() => {
    if (restoredPage && restoredPage > 1 && !searchParams.get('page')) {
      setSearchParams({ page: String(restoredPage) }, { replace: true })
    }
  }, [restoredPage, searchParams, setSearchParams])

  // 初回ロード時とURLのpage変更時にデータを取得
  useEffect(() => {
    loadNotes(currentPage)
  }, [currentPage, loadNotes])

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
