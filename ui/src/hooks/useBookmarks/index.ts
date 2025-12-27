import { useState, useEffect, useCallback } from 'react'
import type { BookmarkNode, CreateBookmarkParams, UpdateBookmarkParams } from '../../types/bookmark'
import {
  fetchBookmarkTree,
  createBookmarkNode,
  updateBookmarkNode,
  deleteBookmarkNode,
  moveBookmarkNode,
} from '../../api/bookmarkApi'

export const useBookmarks = () => {
  const [tree, setTree] = useState<BookmarkNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTree = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchBookmarkTree()
      setTree(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  const createNode = useCallback(
    async (params: CreateBookmarkParams) => {
      try {
        await createBookmarkNode(params)
        await loadTree()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create node')
        throw e
      }
    },
    [loadTree]
  )

  const updateNode = useCallback(
    async (id: string, params: UpdateBookmarkParams) => {
      try {
        await updateBookmarkNode(id, params)
        await loadTree()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update node')
        throw e
      }
    },
    [loadTree]
  )

  const deleteNode = useCallback(
    async (id: string) => {
      try {
        await deleteBookmarkNode(id)
        await loadTree()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete node')
        throw e
      }
    },
    [loadTree]
  )

  const moveNode = useCallback(
    async (id: string, newParentId: string | null, newPosition?: number) => {
      try {
        await moveBookmarkNode(id, { newParentId, newPosition })
        await loadTree()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to move node')
        throw e
      }
    },
    [loadTree]
  )

  const toggleExpand = useCallback(
    async (id: string, isExpanded: boolean) => {
      try {
        await updateBookmarkNode(id, { isExpanded })
        await loadTree()
      } catch (e) {
        // 展開状態の更新失敗は静かに無視
      }
    },
    [loadTree]
  )

  useEffect(() => {
    loadTree()
  }, [loadTree])

  return {
    tree,
    loading,
    error,
    reload: loadTree,
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    toggleExpand,
  }
}
