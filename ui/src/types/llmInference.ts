/**
 * LLM推論機能 フロントエンド型定義
 *
 * v6: Ollama + Qwen2.5:3b によるローカルLLM推論
 */

import type { NoteType } from './note'

// ============================================================
// LLM推論ステータス
// ============================================================

export type LlmInferenceStatus =
  | 'auto_applied'           // 自動反映済み（confidence >= 0.85）
  | 'auto_applied_notified'  // 自動反映（週次通知、0.7-0.85）
  | 'pending'                // 保留中（confidence < 0.7）
  | 'approved'               // ユーザー承認済み
  | 'rejected'               // ユーザー却下
  | 'overridden'             // ユーザー上書き

// ============================================================
// LLM推論候補
// ============================================================

export type LlmInferenceCandidate = {
  noteId: string
  title: string
  currentType: NoteType | 'unknown'
  currentConfidence: number
  reason: string              // 候補に選ばれた理由
}

export type GetCandidatesResult = {
  count: number
  candidates: LlmInferenceCandidate[]
}

// ============================================================
// 推論実行結果
// ============================================================

export type LlmInferenceExecuteResultItem = {
  noteId: string
  type: NoteType
  confidence: number
  status: LlmInferenceStatus
  reasoning: string
}

export type LlmInferenceExecuteResult = {
  executed: number
  results: LlmInferenceExecuteResultItem[]
}

// ============================================================
// 保留中アイテム
// ============================================================

export type PendingItem = {
  id: number
  noteId: string
  title: string
  currentType: NoteType
  suggestedType: NoteType
  confidence: number
  reasoning: string
  createdAt: number
}

export type GetPendingResult = {
  count: number
  items: PendingItem[]
}

// ============================================================
// 週次サマリー
// ============================================================

export type WeeklySummaryStats = {
  autoAppliedHigh: number     // confidence >= 0.85
  autoAppliedMid: number      // confidence 0.7-0.85
  pendingCount: number        // confidence < 0.7
  approvedCount: number
  rejectedCount: number
  overriddenCount: number
}

export type RecentAutoAppliedItem = {
  noteId: string
  title: string
  type: NoteType
  confidence: number
  reasoning: string
  createdAt: number
}

export type WeeklySummary = {
  weekStart: string           // ISO日付 'YYYY-MM-DD'
  weekEnd: string
  stats: WeeklySummaryStats
  recentAutoApplied: RecentAutoAppliedItem[]
  pendingItems: PendingItem[]
}

// ============================================================
// Ollamaヘルスチェック
// ============================================================

export type OllamaHealthStatus = {
  available: boolean
  modelLoaded: boolean
  model: string
  message: string
}

// ============================================================
// API操作結果
// ============================================================

export type LlmInferenceActionResult = {
  success: boolean
  message: string
}
