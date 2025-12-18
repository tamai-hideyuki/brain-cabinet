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

// Active Recall Question Types
export type RecallQuestionType = 'recall' | 'concept' | 'reasoning' | 'application' | 'comparison'

export type RecallQuestion = {
  id: number
  noteId: string
  questionType: RecallQuestionType
  question: string
  expectedKeywords: string[]
  source: 'template' | 'llm'
}

// SM-2 State and Preview
export type SM2State = {
  easinessFactor: number
  interval: number
  repetition: number
}

export type IntervalPreview = {
  quality: number
  qualityLabel: string
  nextInterval: number
  nextIntervalLabel: string
  newEF: number
}

// Review Session Types
export type StartReviewResult = {
  scheduleId: number
  noteId: string
  noteTitle: string
  noteType: NoteType | 'unknown'
  noteContent: string
  currentState: SM2State
  questions: RecallQuestion[]
  previewIntervals: IntervalPreview[]
  fixedRevisionId: string | null
  contentSource: 'fixedRevision' | 'latest'
}

export type SubmitReviewInput = {
  scheduleId: number
  quality: number
  responseTimeMs?: number
  questionsAttempted?: number
  questionsCorrect?: number
}

export type SubmitReviewResult = {
  sessionId: number
  newState: SM2State
  nextReviewAt: number
  nextReviewIn: string
  message: string
}

// Quality Rating (0-5)
export const QUALITY_RATINGS = [
  { value: 0, label: '完全忘却', description: 'まったく思い出せなかった', color: 'error' },
  { value: 1, label: '不正解', description: '答えを見て思い出した', color: 'error' },
  { value: 2, label: 'ほぼ不正解', description: '答えを見て簡単に思い出せた', color: 'warning' },
  { value: 3, label: '正解（困難）', description: '思い出すのに苦労した', color: 'warning' },
  { value: 4, label: '正解', description: '少し躊躇したが思い出せた', color: 'success' },
  { value: 5, label: '完璧', description: 'すぐに思い出せた', color: 'success' },
] as const
