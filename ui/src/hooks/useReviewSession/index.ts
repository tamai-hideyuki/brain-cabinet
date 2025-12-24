import { useState, useCallback } from 'react'
import type { StartReviewResult, SubmitReviewResult } from '../../types/review'
import { startReview, submitReview } from '../../api/reviewApi'

type ReviewSessionState = {
  session: StartReviewResult | null
  loading: boolean
  error: string | null
  submitting: boolean
  result: SubmitReviewResult | null
  startTime: number | null
}

export const useReviewSession = () => {
  const [state, setState] = useState<ReviewSessionState>({
    session: null,
    loading: false,
    error: null,
    submitting: false,
    result: null,
    startTime: null,
  })

  const start = useCallback(async (noteId: string) => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      session: null,
      result: null,
      startTime: null,
    }))

    try {
      const session = await startReview(noteId)
      setState((prev) => ({
        ...prev,
        loading: false,
        session,
        startTime: Date.now(),
      }))
      return session
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to start review'
      setState((prev) => ({
        ...prev,
        loading: false,
        error,
      }))
      throw e
    }
  }, [])

  const submit = useCallback(
    async (quality: number, questionsAttempted?: number, questionsCorrect?: number) => {
      if (!state.session) {
        throw new Error('No active review session')
      }

      setState((prev) => ({ ...prev, submitting: true, error: null }))

      const responseTimeMs = state.startTime ? Date.now() - state.startTime : undefined

      try {
        const result = await submitReview({
          scheduleId: state.session.scheduleId,
          quality,
          responseTimeMs,
          questionsAttempted,
          questionsCorrect,
        })
        setState((prev) => ({
          ...prev,
          submitting: false,
          result,
        }))
        return result
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Failed to submit review'
        setState((prev) => ({
          ...prev,
          submitting: false,
          error,
        }))
        throw e
      }
    },
    [state.session, state.startTime]
  )

  const reset = useCallback(() => {
    setState({
      session: null,
      loading: false,
      error: null,
      submitting: false,
      result: null,
      startTime: null,
    })
  }, [])

  return {
    session: state.session,
    loading: state.loading,
    submitting: state.submitting,
    error: state.error,
    result: state.result,
    start,
    submit,
    reset,
  }
}
