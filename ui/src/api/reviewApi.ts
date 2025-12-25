import type {
  ReviewListResponse,
  StartReviewResult,
  SubmitReviewInput,
  SubmitReviewResult,
} from '../types/review'
import { sendCommand } from './commandClient'

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
