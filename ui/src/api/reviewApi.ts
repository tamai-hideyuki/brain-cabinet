import type {
  ReviewListResponse,
  StartReviewResult,
  SubmitReviewInput,
  SubmitReviewResult,
} from '../types/review'
import { fetchWithAuth } from './client'

const API_BASE = '/api'

type CommandResponse<T> = {
  success: boolean
  action: string
  result: T
}

async function sendCommand<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })
  if (!res.ok) throw new Error(`Failed to execute ${action}`)
  const data: CommandResponse<T> = await res.json()
  if (!data.success) throw new Error(`Command ${action} failed`)
  return data.result
}

export const fetchReviewList = async (): Promise<ReviewListResponse> => {
  return sendCommand<ReviewListResponse>('review.list')
}

export const startReview = async (noteId: string): Promise<StartReviewResult> => {
  return sendCommand<StartReviewResult>('review.start', { noteId })
}

export const submitReview = async (input: SubmitReviewInput): Promise<SubmitReviewResult> => {
  return sendCommand<SubmitReviewResult>('review.submit', input)
}

// Schedule a note for review (force: true to add any note type)
export const scheduleReview = async (noteId: string, force = true): Promise<{ success: boolean; message: string }> => {
  return sendCommand<{ success: boolean; message: string }>('review.schedule', { noteId, force })
}

// Cancel/remove a note from review list
export const cancelReview = async (noteId: string): Promise<{ success: boolean; message: string }> => {
  return sendCommand<{ success: boolean; message: string }>('review.cancel', { noteId })
}
