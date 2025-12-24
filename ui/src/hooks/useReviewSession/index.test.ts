import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReviewSession } from './index'
import * as reviewApi from '../../api/reviewApi'
import type { StartReviewResult, SubmitReviewResult } from '../../types/review'

vi.mock('../../api/reviewApi')

const mockSession: StartReviewResult = {
  scheduleId: 1,
  noteId: '11111111-1111-1111-1111-111111111111',
  noteTitle: 'Test note',
  noteType: 'learning',
  noteContent: 'Test note content',
  currentState: { easinessFactor: 2.5, interval: 1, repetition: 0 },
  questions: [],
  previewIntervals: [],
  fixedRevisionId: null,
  contentSource: 'latest',
}

const mockSubmitResult: SubmitReviewResult = {
  sessionId: 1,
  newState: { easinessFactor: 2.6, interval: 6, repetition: 1 },
  nextReviewAt: Date.now() + 86400000,
  nextReviewIn: '1 day',
  message: 'Review recorded',
}

describe('useReviewSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('初期状態', () => {
    const { result } = renderHook(() => useReviewSession())

    expect(result.current.session).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.submitting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.result).toBeNull()
  })

  it('startでレビューセッションを開始する', async () => {
    vi.mocked(reviewApi.startReview).mockResolvedValue(mockSession)

    const { result } = renderHook(() => useReviewSession())

    let startResult: StartReviewResult | undefined
    await act(async () => {
      startResult = await result.current.start('11111111-1111-1111-1111-111111111111')
    })

    expect(startResult).toEqual(mockSession)
    expect(result.current.session).toEqual(mockSession)
    expect(result.current.loading).toBe(false)
    expect(reviewApi.startReview).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
  })

  it('start中はloadingがtrueになる', async () => {
    vi.mocked(reviewApi.startReview).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useReviewSession())

    act(() => {
      result.current.start('11111111-1111-1111-1111-111111111111')
    })

    expect(result.current.loading).toBe(true)
  })

  it('startエラー時にerrorがセットされ例外がスローされる', async () => {
    vi.mocked(reviewApi.startReview).mockRejectedValue(new Error('Start failed'))

    const { result } = renderHook(() => useReviewSession())

    let thrownError: unknown = null
    await act(async () => {
      try {
        await result.current.start('11111111-1111-1111-1111-111111111111')
      } catch (e) {
        thrownError = e
      }
    })

    expect(thrownError).toBeInstanceOf(Error)
    expect((thrownError as Error).message).toBe('Start failed')
    expect(result.current.error).toBe('Start failed')
    expect(result.current.loading).toBe(false)
  })

  it('submitでレビュー結果を送信する', async () => {
    vi.mocked(reviewApi.startReview).mockResolvedValue(mockSession)
    vi.mocked(reviewApi.submitReview).mockResolvedValue(mockSubmitResult)

    const { result } = renderHook(() => useReviewSession())

    await act(async () => {
      await result.current.start('11111111-1111-1111-1111-111111111111')
    })

    vi.advanceTimersByTime(5000)

    let submitResult: SubmitReviewResult | undefined
    await act(async () => {
      submitResult = await result.current.submit(4)
    })

    expect(submitResult).toEqual(mockSubmitResult)
    expect(result.current.result).toEqual(mockSubmitResult)
    expect(result.current.submitting).toBe(false)
    expect(reviewApi.submitReview).toHaveBeenCalledWith({
      scheduleId: 1,
      quality: 4,
      responseTimeMs: 5000,
      questionsAttempted: undefined,
      questionsCorrect: undefined,
    })
  })

  it('submitでクイズ情報も送信できる', async () => {
    vi.mocked(reviewApi.startReview).mockResolvedValue(mockSession)
    vi.mocked(reviewApi.submitReview).mockResolvedValue(mockSubmitResult)

    const { result } = renderHook(() => useReviewSession())

    await act(async () => {
      await result.current.start('11111111-1111-1111-1111-111111111111')
    })

    await act(async () => {
      await result.current.submit(5, 3, 2)
    })

    expect(reviewApi.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        questionsAttempted: 3,
        questionsCorrect: 2,
      })
    )
  })

  it('セッションなしでsubmitを呼ぶと例外がスローされる', async () => {
    const { result } = renderHook(() => useReviewSession())

    await expect(
      act(async () => {
        await result.current.submit(4)
      })
    ).rejects.toThrow('No active review session')
  })

  it('submitエラー時にerrorがセットされ例外がスローされる', async () => {
    vi.mocked(reviewApi.startReview).mockResolvedValue(mockSession)
    vi.mocked(reviewApi.submitReview).mockRejectedValue(new Error('Submit failed'))

    const { result } = renderHook(() => useReviewSession())

    await act(async () => {
      await result.current.start('11111111-1111-1111-1111-111111111111')
    })

    let thrownError: unknown = null
    await act(async () => {
      try {
        await result.current.submit(4)
      } catch (e) {
        thrownError = e
      }
    })

    expect(thrownError).toBeInstanceOf(Error)
    expect((thrownError as Error).message).toBe('Submit failed')
    expect(result.current.error).toBe('Submit failed')
    expect(result.current.submitting).toBe(false)
  })

  it('resetで状態をリセットする', async () => {
    vi.mocked(reviewApi.startReview).mockResolvedValue(mockSession)
    vi.mocked(reviewApi.submitReview).mockResolvedValue(mockSubmitResult)

    const { result } = renderHook(() => useReviewSession())

    await act(async () => {
      await result.current.start('11111111-1111-1111-1111-111111111111')
    })

    await act(async () => {
      await result.current.submit(4)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.session).toBeNull()
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('submit中はsubmittingがtrueになる', async () => {
    vi.mocked(reviewApi.startReview).mockResolvedValue(mockSession)
    vi.mocked(reviewApi.submitReview).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useReviewSession())

    await act(async () => {
      await result.current.start('11111111-1111-1111-1111-111111111111')
    })

    act(() => {
      result.current.submit(4)
    })

    expect(result.current.submitting).toBe(true)
  })
})
