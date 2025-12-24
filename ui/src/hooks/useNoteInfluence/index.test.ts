import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNoteInfluence } from './index'
import * as influenceApi from '../../api/influenceApi'
import type { NoteInfluence } from '../../types/influence'

vi.mock('../../api/influenceApi')

const mockInfluence: NoteInfluence = {
  note: {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Test Note',
    clusterId: 1,
  },
  summary: {
    incomingEdges: 2,
    outgoingEdges: 1,
    totalIncomingInfluence: 0.85,
    totalOutgoingInfluence: 0.5,
  },
  influencers: [
    {
      sourceNoteId: '22222222-2222-2222-2222-222222222222',
      targetNoteId: '11111111-1111-1111-1111-111111111111',
      weight: 0.8,
      cosineSim: 0.9,
      driftScore: 0.1,
    },
  ],
  influenced: [
    {
      sourceNoteId: '11111111-1111-1111-1111-111111111111',
      targetNoteId: '33333333-3333-3333-3333-333333333333',
      weight: 0.5,
      cosineSim: 0.7,
      driftScore: 0.2,
    },
  ],
}

describe('useNoteInfluence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('noteIdがnullの場合はloadingがfalseで何もしない', async () => {
    const { result } = renderHook(() => useNoteInfluence(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.influence).toBeNull()
    expect(influenceApi.fetchNoteInfluence).not.toHaveBeenCalled()
  })

  it('noteIdがあればインフルエンスを取得する', async () => {
    vi.mocked(influenceApi.fetchNoteInfluence).mockResolvedValue(mockInfluence)

    const { result } = renderHook(() => useNoteInfluence('11111111-1111-1111-1111-111111111111'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.influence).toEqual(mockInfluence)
    expect(result.current.error).toBeNull()
    expect(influenceApi.fetchNoteInfluence).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111'
    )
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(influenceApi.fetchNoteInfluence).mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(() => useNoteInfluence('invalid-id'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Not found')
    expect(result.current.influence).toBeNull()
  })

  it('noteIdが変更されると再取得する', async () => {
    vi.mocked(influenceApi.fetchNoteInfluence).mockResolvedValue(mockInfluence)

    const { result, rerender } = renderHook(({ noteId }) => useNoteInfluence(noteId), {
      initialProps: { noteId: '11111111-1111-1111-1111-111111111111' as string | null },
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(influenceApi.fetchNoteInfluence).toHaveBeenCalledTimes(1)

    rerender({ noteId: '22222222-2222-2222-2222-222222222222' })

    await waitFor(() => {
      expect(influenceApi.fetchNoteInfluence).toHaveBeenCalledTimes(2)
    })

    expect(influenceApi.fetchNoteInfluence).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222'
    )
  })

  it('reloadでインフルエンスを再取得する', async () => {
    vi.mocked(influenceApi.fetchNoteInfluence).mockResolvedValue(mockInfluence)

    const { result } = renderHook(() => useNoteInfluence('11111111-1111-1111-1111-111111111111'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(influenceApi.fetchNoteInfluence).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(influenceApi.fetchNoteInfluence).toHaveBeenCalledTimes(2)
  })

  it('reloadはnoteIdがnullの場合は何もしない', async () => {
    const { result } = renderHook(() => useNoteInfluence(null))

    await act(async () => {
      await result.current.reload()
    })

    expect(influenceApi.fetchNoteInfluence).not.toHaveBeenCalled()
  })
})
