import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useReviews } from './index'
import * as reviewApi from '../../api/reviewApi'
import type { ReviewListResponse } from '../../types/review'

vi.mock('../../api/reviewApi')

const mockData: ReviewListResponse = {
  overdue: [],
  today: [
    {
      noteId: '11111111-1111-1111-1111-111111111111',
      noteTitle: 'Note 1',
      noteType: 'learning',
      nextReviewIn: 'today',
      schedule: {
        id: 1,
        noteId: '11111111-1111-1111-1111-111111111111',
        easinessFactor: 2.5,
        interval: 1,
        repetition: 0,
        nextReviewAt: Date.now(),
        lastReviewedAt: null,
        scheduledBy: 'user',
        isActive: 1,
      },
    },
  ],
  tomorrow: [],
  thisWeek: [],
  later: [],
  total: 1,
}

describe('useReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(reviewApi.fetchReviewList).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useReviews())

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('レビューリストを取得する', async () => {
    vi.mocked(reviewApi.fetchReviewList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useReviews())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(reviewApi.fetchReviewList).mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => useReviews())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('API error')
    expect(result.current.data).toBeNull()
  })

  it('reloadでレビューリストを再取得する', async () => {
    vi.mocked(reviewApi.fetchReviewList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useReviews())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(reviewApi.fetchReviewList).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(reviewApi.fetchReviewList).toHaveBeenCalledTimes(2)
  })
})
