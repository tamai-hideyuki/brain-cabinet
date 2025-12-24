import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNote } from './index'
import * as notesApi from '../../api/notesApi'
import type { Note, NoteHistory } from '../../types/note'

vi.mock('../../api/notesApi')

const mockNote: Note = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Test note',
  content: 'Test note content',
  path: null,
  tags: [],
  category: null,
  clusterId: null,
  createdAt: 1000,
  updatedAt: 2000,
}

const mockHistory: NoteHistory[] = [
  {
    id: 'history-1',
    noteId: '11111111-1111-1111-1111-111111111111',
    content: 'Old content',
    diff: null,
    semanticDiff: null,
    prevClusterId: null,
    newClusterId: null,
    createdAt: 500,
  },
]

describe('useNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(notesApi.fetchNote).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useNote('11111111-1111-1111-1111-111111111111'))

    expect(result.current.loading).toBe(true)
    expect(result.current.note).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('idがundefinedの場合はloadingをfalseにして何もしない', async () => {
    const { result } = renderHook(() => useNote(undefined))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.note).toBeNull()
    expect(notesApi.fetchNote).not.toHaveBeenCalled()
  })

  it('ノートを取得する', async () => {
    vi.mocked(notesApi.fetchNote).mockResolvedValue(mockNote)

    const { result } = renderHook(() => useNote('11111111-1111-1111-1111-111111111111'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.note).toEqual(mockNote)
    expect(result.current.error).toBeNull()
    expect(notesApi.fetchNote).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(notesApi.fetchNote).mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(() => useNote('invalid-id'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Not found')
    expect(result.current.note).toBeNull()
  })

  it('idが変更されると再取得する', async () => {
    vi.mocked(notesApi.fetchNote).mockResolvedValue(mockNote)

    const { result, rerender } = renderHook(({ id }) => useNote(id), {
      initialProps: { id: '11111111-1111-1111-1111-111111111111' },
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(notesApi.fetchNote).toHaveBeenCalledTimes(1)

    rerender({ id: '22222222-2222-2222-2222-222222222222' })

    await waitFor(() => {
      expect(notesApi.fetchNote).toHaveBeenCalledTimes(2)
    })

    expect(notesApi.fetchNote).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222')
  })

  it('loadHistoryで履歴を取得する', async () => {
    vi.mocked(notesApi.fetchNote).mockResolvedValue(mockNote)
    vi.mocked(notesApi.fetchNoteHistory).mockResolvedValue(mockHistory)

    const { result } = renderHook(() => useNote('11111111-1111-1111-1111-111111111111'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.history).toEqual([])
    expect(result.current.historyLoading).toBe(false)

    await act(async () => {
      await result.current.loadHistory()
    })

    expect(result.current.history).toEqual(mockHistory)
    expect(notesApi.fetchNoteHistory).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
  })

  it('idがundefinedの場合loadHistoryは何もしない', async () => {
    const { result } = renderHook(() => useNote(undefined))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.loadHistory()
    })

    expect(notesApi.fetchNoteHistory).not.toHaveBeenCalled()
  })

  it('履歴取得エラーは静かにログ出力される', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(notesApi.fetchNote).mockResolvedValue(mockNote)
    vi.mocked(notesApi.fetchNoteHistory).mockRejectedValue(new Error('History failed'))

    const { result } = renderHook(() => useNote('11111111-1111-1111-1111-111111111111'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.loadHistory()
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load history:', expect.any(Error))
    expect(result.current.history).toEqual([])

    consoleSpy.mockRestore()
  })

  it('reloadでノートを再取得する', async () => {
    vi.mocked(notesApi.fetchNote).mockResolvedValue(mockNote)

    const { result } = renderHook(() => useNote('11111111-1111-1111-1111-111111111111'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(notesApi.fetchNote).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(notesApi.fetchNote).toHaveBeenCalledTimes(2)
  })
})
