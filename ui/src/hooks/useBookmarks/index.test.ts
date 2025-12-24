import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useBookmarks } from './index'
import * as bookmarkApi from '../../api/bookmarkApi'
import type { BookmarkNode } from '../../types/bookmark'

vi.mock('../../api/bookmarkApi')

const mockTree: BookmarkNode[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Folder 1',
    type: 'folder',
    parentId: null,
    noteId: null,
    url: null,
    position: 0,
    isExpanded: true,
    createdAt: 1000,
    updatedAt: 1000,
    children: [],
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Link 1',
    type: 'link',
    parentId: null,
    noteId: null,
    url: 'https://example.com',
    position: 1,
    isExpanded: false,
    createdAt: 2000,
    updatedAt: 2000,
  },
]

describe('useBookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useBookmarks())

    expect(result.current.loading).toBe(true)
    expect(result.current.tree).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('ブックマークツリーを取得する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.tree).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.tree).toEqual([])
  })

  it('reloadでツリーを再取得する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(bookmarkApi.fetchBookmarkTree).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(bookmarkApi.fetchBookmarkTree).toHaveBeenCalledTimes(2)
  })

  it('createNodeでノードを作成後、ツリーを再取得する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.createBookmarkNode).mockResolvedValue({
      id: 'new-id',
      name: 'New Folder',
      type: 'folder',
      parentId: null,
      noteId: null,
      url: null,
      position: 2,
      isExpanded: false,
      createdAt: 3000,
      updatedAt: 3000,
    })

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.createNode({ name: 'New Folder', type: 'folder' })
    })

    expect(bookmarkApi.createBookmarkNode).toHaveBeenCalledWith({
      name: 'New Folder',
      type: 'folder',
    })
    expect(bookmarkApi.fetchBookmarkTree).toHaveBeenCalledTimes(2)
  })

  it('createNodeエラー時にエラーがセットされ例外がスローされる', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.createBookmarkNode).mockRejectedValue(new Error('Create failed'))

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let thrownError: unknown = null
    await act(async () => {
      try {
        await result.current.createNode({ name: 'Test', type: 'folder' })
      } catch (e) {
        thrownError = e
      }
    })

    expect(thrownError).toBeInstanceOf(Error)
    expect((thrownError as Error).message).toBe('Create failed')
    expect(result.current.error).toBe('Create failed')
  })

  it('updateNodeでノードを更新後、ツリーを再取得する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.updateBookmarkNode).mockResolvedValue({
      ...mockTree[0],
      name: 'Updated Folder',
    })

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.updateNode('11111111-1111-1111-1111-111111111111', {
        name: 'Updated Folder',
      })
    })

    expect(bookmarkApi.updateBookmarkNode).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      { name: 'Updated Folder' }
    )
    expect(bookmarkApi.fetchBookmarkTree).toHaveBeenCalledTimes(2)
  })

  it('deleteNodeでノードを削除後、ツリーを再取得する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.deleteBookmarkNode).mockResolvedValue(undefined)

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.deleteNode('11111111-1111-1111-1111-111111111111')
    })

    expect(bookmarkApi.deleteBookmarkNode).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111'
    )
    expect(bookmarkApi.fetchBookmarkTree).toHaveBeenCalledTimes(2)
  })

  it('moveNodeでノードを移動後、ツリーを再取得する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.moveBookmarkNode).mockResolvedValue({
      ...mockTree[1],
      parentId: '11111111-1111-1111-1111-111111111111',
      position: 0,
    })

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.moveNode(
        '22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        0
      )
    })

    expect(bookmarkApi.moveBookmarkNode).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      { parentId: '11111111-1111-1111-1111-111111111111', position: 0 }
    )
    expect(bookmarkApi.fetchBookmarkTree).toHaveBeenCalledTimes(2)
  })

  it('toggleExpandで展開状態を更新する', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.updateBookmarkNode).mockResolvedValue({
      ...mockTree[0],
      isExpanded: false,
    })

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.toggleExpand('11111111-1111-1111-1111-111111111111', false)
    })

    expect(bookmarkApi.updateBookmarkNode).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      { isExpanded: false }
    )
  })

  it('toggleExpandエラー時は静かに無視される', async () => {
    vi.mocked(bookmarkApi.fetchBookmarkTree).mockResolvedValue(mockTree)
    vi.mocked(bookmarkApi.updateBookmarkNode).mockRejectedValue(new Error('Update failed'))

    const { result } = renderHook(() => useBookmarks())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.toggleExpand('11111111-1111-1111-1111-111111111111', false)
    })

    expect(result.current.error).toBeNull()
  })
})
