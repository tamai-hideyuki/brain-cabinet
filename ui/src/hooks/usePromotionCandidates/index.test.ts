import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePromotionCandidates } from './index'
import * as notesApi from '../../api/notesApi'
import type { PromotionCandidate } from '../../types/note'

vi.mock('../../api/notesApi')

const mockCandidates: PromotionCandidate[] = [
  {
    noteId: '11111111-1111-1111-1111-111111111111',
    title: 'Note 1',
    currentType: 'scratch',
    confidence: 0.95,
    suggestedType: 'learning',
    reason: 'High engagement',
  },
  {
    noteId: '22222222-2222-2222-2222-222222222222',
    title: 'Note 2',
    currentType: 'scratch',
    confidence: 0.85,
    suggestedType: 'decision',
    reason: 'Referenced often',
  },
]

describe('usePromotionCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => usePromotionCandidates())

    expect(result.current.loading).toBe(true)
    expect(result.current.candidates).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('昇格候補を取得する', async () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => usePromotionCandidates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.candidates).toEqual(mockCandidates)
    expect(result.current.error).toBeNull()
    expect(notesApi.fetchPromotionCandidates).toHaveBeenCalledWith(10)
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => usePromotionCandidates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('API error')
    expect(result.current.candidates).toEqual([])
  })

  it('reloadで候補を再取得する', async () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => usePromotionCandidates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(notesApi.fetchPromotionCandidates).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(notesApi.fetchPromotionCandidates).toHaveBeenCalledTimes(2)
  })

  it('isPromotionCandidateで候補かどうかを判定できる', async () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => usePromotionCandidates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.isPromotionCandidate('11111111-1111-1111-1111-111111111111')).toEqual(
      mockCandidates[0]
    )
    expect(
      result.current.isPromotionCandidate('33333333-3333-3333-3333-333333333333')
    ).toBeUndefined()
  })

  it('candidateIdsで候補IDのSetを取得できる', async () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => usePromotionCandidates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.candidateIds.has('11111111-1111-1111-1111-111111111111')).toBe(true)
    expect(result.current.candidateIds.has('22222222-2222-2222-2222-222222222222')).toBe(true)
    expect(result.current.candidateIds.has('33333333-3333-3333-3333-333333333333')).toBe(false)
    expect(result.current.candidateIds.size).toBe(2)
  })

  it('candidateIdsは候補が空の場合は空のSetになる', async () => {
    vi.mocked(notesApi.fetchPromotionCandidates).mockResolvedValue([])

    const { result } = renderHook(() => usePromotionCandidates())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.candidateIds.size).toBe(0)
  })
})
