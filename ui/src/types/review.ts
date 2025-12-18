import type { NoteType } from './note'

export type ReviewSchedule = {
  id: number
  noteId: string
  easinessFactor: number
  interval: number
  repetition: number
  nextReviewAt: number
  lastReviewedAt: number | null
  scheduledBy: string
  isActive: number
}

export type ReviewItem = {
  noteId: string
  schedule: ReviewSchedule
  noteTitle: string
  noteType: NoteType | 'unknown'
  nextReviewIn: string
}

export type ReviewQueueResponse = {
  total: number
  dueToday: number
  overdue: number
  reviews: ReviewItem[]
}

export type ReviewGroup = {
  label: string
  items: ReviewItem[]
}

export type ReviewListResponse = {
  overdue: ReviewItem[]
  today: ReviewItem[]
  tomorrow: ReviewItem[]
  thisWeek: ReviewItem[]
  later: ReviewItem[]
  total: number
}
