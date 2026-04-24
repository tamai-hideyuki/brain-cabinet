import { useState, useEffect, useCallback, useRef } from 'react'
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

  // sessionStorageから復元する検索状態（初回マウント時のみ読み取る）
  // 詳細ページから戻った時に検索結果一覧を維持するための仕組み
  const [restoredSearchData] = useState<{ search: string; mode: SearchMode } | null>(() => {
    const savedSearch = sessionStorage.getItem('notesListSearch')
    if (!savedSearch) return null
    sessionStorage.removeItem('notesListSearch')
    const savedMode = (sessionStorage.getItem('notesListSearchMode') as SearchMode) || 'keyword'
    sessionStorage.removeItem('notesListSearchMode')
    return { search: savedSearch, mode: savedMode }
  })

  const [search, setSearch] = useState(restoredSearchData?.search ?? '')
  const [searchMode, setSearchMode] = useState<SearchMode>(restoredSearchData?.mode ?? 'keyword')

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

  // 初回マウントで一度だけ復元処理を行うためのフラグ。
  // restoredSearchData は state なので useEffect 後も真のままだが、currentPage 変更時に
  // 再度 executeSearch を呼びたくないため、ref で「初回処理済み」を記録する。
  const initialEffectDoneRef = useRef(false)

  // 初回マウント: 検索復元があれば実行、なければ通常のloadNotes
  // 以降のcurrentPage変更（ページネーション等）は loadNotes
  useEffect(() => {
    if (!initialEffectDoneRef.current) {
      initialEffectDoneRef.current = true
      if (restoredSearchData) {
        executeSearch()
        return
      }
    }
    loadNotes(currentPage)
    // executeSearch を依存配列に含めると無限ループになるため除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
