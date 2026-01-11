import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useNotes } from './index'
import * as notesApi from '../../api/notesApi'
import type { Note } from '../../types/note'

vi.mock('../../api/notesApi')

const mockNotes: Note[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Note 1',
    content: 'Content 1',
    path: null,
    tags: [],
    category: null,
    clusterId: null,
    createdAt: 1000,
    updatedAt: 2000,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Note 2',
    content: 'Content 2',
    path: null,
    tags: [],
    category: null,
    clusterId: null,
    createdAt: 2000,
    updatedAt: 3000,
  },
]

const mockFetchNotesResult = { notes: mockNotes, total: mockNotes.length }

// React Router wrapper for hooks that use useSearchParams
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

describe('useNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(notesApi.fetchNotes).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useNotes(), { wrapper })

    expect(result.current.loading).toBe(true)
    expect(result.current.notes).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('ノートを取得して更新日時順にソートする', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.notes).toHaveLength(2)
    expect(result.current.notes[0].id).toBe('22222222-2222-2222-2222-222222222222')
    expect(result.current.notes[1].id).toBe('11111111-1111-1111-1111-111111111111')
    expect(result.current.error).toBeNull()
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(notesApi.fetchNotes).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.notes).toEqual([])
  })

  it('reloadでノートを再取得する', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(notesApi.fetchNotes).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(notesApi.fetchNotes).toHaveBeenCalledTimes(2)
  })

  it('setSearchで検索クエリを設定できる', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSearch('test')
    })

    expect(result.current.search).toBe('test')
  })

  it('setSearchModeで検索モードを設定できる', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSearchMode('semantic')
    })

    expect(result.current.searchMode).toBe('semantic')
  })

  it('executeSearchでキーワード検索を実行する', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)
    vi.mocked(notesApi.searchNotes).mockResolvedValue([mockNotes[0]])

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSearch('Note 1')
    })

    await act(async () => {
      await result.current.executeSearch()
    })

    expect(notesApi.searchNotes).toHaveBeenCalledWith('Note 1', 'keyword')
    expect(result.current.notes).toHaveLength(1)
  })

  it('空の検索クエリでexecuteSearchを実行するとloadNotesが呼ばれる', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(notesApi.fetchNotes).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.executeSearch()
    })

    expect(notesApi.fetchNotes).toHaveBeenCalledTimes(2)
    expect(notesApi.searchNotes).not.toHaveBeenCalled()
  })

  it('検索エラー時にerrorがセットされる', async () => {
    vi.mocked(notesApi.fetchNotes).mockResolvedValue(mockFetchNotesResult)
    vi.mocked(notesApi.searchNotes).mockRejectedValue(new Error('Search failed'))

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setSearch('test')
    })

    await act(async () => {
      await result.current.executeSearch()
    })

    expect(result.current.error).toBe('Search failed')
  })

  it('同じ更新日時のノートは作成日時でソートされる', async () => {
    const notesWithSameUpdatedAt: Note[] = [
      {
        id: 'aaa',
        title: 'Older',
        content: 'Older content',
        path: null,
        tags: [],
        category: null,
        clusterId: null,
        createdAt: 1000,
        updatedAt: 3000,
      },
      {
        id: 'bbb',
        title: 'Newer',
        content: 'Newer content',
        path: null,
        tags: [],
        category: null,
        clusterId: null,
        createdAt: 2000,
        updatedAt: 3000,
      },
    ]
    vi.mocked(notesApi.fetchNotes).mockResolvedValue({ notes: notesWithSameUpdatedAt, total: notesWithSameUpdatedAt.length })

    const { result } = renderHook(() => useNotes(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.notes[0].id).toBe('bbb')
    expect(result.current.notes[1].id).toBe('aaa')
  })
})
