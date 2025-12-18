import type { ReviewListResponse } from '../types/review'

const API_BASE = '/api'

type CommandResponse<T> = {
  success: boolean
  action: string
  result: T
}

export const fetchReviewList = async (): Promise<ReviewListResponse> => {
  const res = await fetch(`${API_BASE}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'review.list' }),
  })
  if (!res.ok) throw new Error('Failed to fetch review list')
  const data: CommandResponse<ReviewListResponse> = await res.json()
  if (!data.success) throw new Error('Command failed')
  return data.result
}
