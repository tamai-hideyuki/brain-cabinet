/**
 * 週次LLM推論サマリーセクション
 *
 * Dashboard内に表示する週次サマリーコンポーネント
 * v6.1: 情報量拡充 + iPhone 16 Pro Max対応
 */

import { useState } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { useWeeklySummary, useOllamaHealth, useLlmExecute } from '../../../hooks/useLlmInference'
import { LlmInferenceModal } from '../LlmInferenceModal'
import { PendingReviewModal } from '../PendingReviewModal'
import type { RecentAutoAppliedItem } from '../../../types/llmInference'
import './WeeklySummarySection.css'

type WeeklySummarySectionProps = {
  onNoteClick?: (noteId: string) => void
}

type ReviewModalMode = 'pending' | 'auto_applied_notified' | null

// タイプ別の表示ラベルと色
const TYPE_CONFIG: Record<string, { label: string; variant: 'decision' | 'learning' | 'default' }> = {
  decision: { label: '判断', variant: 'decision' },
  learning: { label: '学習', variant: 'learning' },
  scratch: { label: '検討中', variant: 'default' },
  emotion: { label: '感情', variant: 'default' },
  log: { label: '記録', variant: 'default' },
}

// 信頼度バーのカラー
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.85) return 'var(--color-success-text)'
  if (confidence >= 0.7) return 'var(--color-warning-text)'
  return 'var(--color-text-muted)'
}

// タイプ別集計
const countByType = (items: RecentAutoAppliedItem[]): Record<string, number> => {
  return items.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export const WeeklySummarySection = ({ onNoteClick }: WeeklySummarySectionProps) => {
  const { summary, loading, error, reload } = useWeeklySummary()
  const { health } = useOllamaHealth()
  const { executing, execute } = useLlmExecute()
  const [showInferenceModal, setShowInferenceModal] = useState(false)
  const [reviewModalMode, setReviewModalMode] = useState<ReviewModalMode>(null)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  // 未使用だがExecuteモーダル経由でなく直接実行したい場合に使用可能
  void execute

  if (loading) {
    return (
      <div className="weekly-summary weekly-summary--loading">
        <Spinner size="sm" />
        <Text variant="caption">LLM推論サマリーを読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="weekly-summary weekly-summary--error">
        <Text variant="caption">{error}</Text>
      </div>
    )
  }

  if (!summary) return null

  const { stats, pendingItems, recentAutoApplied } = summary
  const totalProcessed = stats.autoAppliedHigh + stats.autoAppliedMid
  const hasActivity = totalProcessed > 0 || stats.pendingCount > 0
  const typeCounts = countByType(recentAutoApplied)

  // Ollamaが利用可能かどうか
  const ollamaReady = health?.available && health?.modelLoaded

  // 精度率（承認 / (承認+上書き)）
  const totalReviewed = stats.approvedCount + stats.overriddenCount
  const accuracyRate = totalReviewed > 0
    ? Math.round((stats.approvedCount / totalReviewed) * 100)
    : null

  return (
    <div className="weekly-summary">
      {/* ヘッダー */}
      <div className="weekly-summary__header">
        <div className="weekly-summary__title">
          <Text variant="subtitle">LLM推論サマリー</Text>
          <Badge variant={ollamaReady ? 'learning' : 'default'}>
            {ollamaReady ? '準備完了' : '停止中'}
          </Badge>
        </div>
        <span className="weekly-summary__date-range">
          <Text variant="caption">
            {summary.weekStart} 〜 {summary.weekEnd}
          </Text>
        </span>
      </div>

      {hasActivity ? (
        <>
          {/* メイン統計カード */}
          <div className="weekly-summary__stats-grid">
            <div className="weekly-summary__stat-card weekly-summary__stat-card--primary">
              <span className="weekly-summary__stat-number">{totalProcessed}</span>
              <Text variant="caption">自動反映</Text>
              <div className="weekly-summary__stat-breakdown">
                <Text variant="caption">
                  高信頼 {stats.autoAppliedHigh} / 中信頼 {stats.autoAppliedMid}
                </Text>
              </div>
            </div>
            <div className="weekly-summary__stat-card">
              <span className="weekly-summary__stat-number">{stats.pendingCount}</span>
              <Text variant="caption">保留中</Text>
            </div>
            <div className="weekly-summary__stat-card">
              <span className="weekly-summary__stat-number">{stats.approvedCount + stats.overriddenCount}</span>
              <Text variant="caption">確認済み</Text>
              {accuracyRate !== null && (
                <div className="weekly-summary__stat-breakdown">
                  <Text variant="caption">精度 {accuracyRate}%</Text>
                </div>
              )}
            </div>
          </div>

          {/* タイプ別分布 */}
          {Object.keys(typeCounts).length > 0 && (
            <div className="weekly-summary__type-distribution">
              <span className="weekly-summary__section-label">
                <Text variant="caption">タイプ別分布</Text>
              </span>
              <div className="weekly-summary__type-chips">
                {Object.entries(typeCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const config = TYPE_CONFIG[type] || { label: type, variant: 'default' as const }
                    return (
                      <div key={type} className="weekly-summary__type-chip">
                        <Badge variant={config.variant}>{config.label}</Badge>
                        <span className="weekly-summary__type-count">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* 今週の自動分類（確認推奨） */}
          {recentAutoApplied.length > 0 && (
            <div className="weekly-summary__recent">
              <span className="weekly-summary__section-label">
                <Text variant="caption">今週の自動分類（確認推奨）</Text>
              </span>
              <div className="weekly-summary__list">
                {recentAutoApplied.slice(0, 5).map((item) => {
                  const config = TYPE_CONFIG[item.type] || { label: item.type, variant: 'default' as const }
                  const isExpanded = expandedItemId === item.noteId

                  return (
                    <div
                      key={item.noteId}
                      className={`weekly-summary__item ${isExpanded ? 'weekly-summary__item--expanded' : ''}`}
                    >
                      <button
                        className="weekly-summary__item-main"
                        onClick={() => onNoteClick?.(item.noteId)}
                      >
                        <div className="weekly-summary__item-content">
                          <Text variant="body" truncate>
                            {item.title}
                          </Text>
                          <div className="weekly-summary__item-meta">
                            <Badge variant={config.variant}>{config.label}</Badge>
                            <div className="weekly-summary__confidence">
                              <div
                                className="weekly-summary__confidence-bar"
                                style={{
                                  width: `${item.confidence * 100}%`,
                                  backgroundColor: getConfidenceColor(item.confidence),
                                }}
                              />
                            </div>
                            <span className="weekly-summary__confidence-value">
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        className="weekly-summary__item-expand"
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedItemId(isExpanded ? null : item.noteId)
                        }}
                        aria-label={isExpanded ? '詳細を閉じる' : '詳細を見る'}
                      >
                        <span className={`weekly-summary__expand-icon ${isExpanded ? 'weekly-summary__expand-icon--open' : ''}`}>
                          ▼
                        </span>
                      </button>
                      {isExpanded && item.reasoning && (
                        <div className="weekly-summary__item-reasoning">
                          <span className="weekly-summary__reasoning-label">
                            <Text variant="caption">推論理由:</Text>
                          </span>
                          <Text variant="caption">{item.reasoning}</Text>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 保留中 */}
          {pendingItems.length > 0 && (
            <div className="weekly-summary__pending">
              <span className="weekly-summary__section-label">
                <Text variant="caption">保留中（確認が必要）</Text>
              </span>
              <div className="weekly-summary__list">
                {pendingItems.slice(0, 3).map((item) => {
                  const suggestedConfig = TYPE_CONFIG[item.suggestedType] || { label: item.suggestedType, variant: 'default' as const }

                  return (
                    <button
                      key={item.id}
                      className="weekly-summary__pending-item"
                      onClick={() => onNoteClick?.(item.noteId)}
                    >
                      <div className="weekly-summary__pending-content">
                        <Text variant="body" truncate>
                          {item.title}
                        </Text>
                        <div className="weekly-summary__pending-meta">
                          <span className="weekly-summary__type-change">
                            <span className="weekly-summary__type-from">{item.currentType}</span>
                            <span className="weekly-summary__type-arrow">→</span>
                            <Badge variant={suggestedConfig.variant}>{suggestedConfig.label}</Badge>
                          </span>
                          <div className="weekly-summary__confidence">
                            <div
                              className="weekly-summary__confidence-bar"
                              style={{
                                width: `${item.confidence * 100}%`,
                                backgroundColor: getConfidenceColor(item.confidence),
                              }}
                            />
                          </div>
                          <span className="weekly-summary__confidence-value">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="weekly-summary__empty">
          <div className="weekly-summary__empty-icon">🤖</div>
          <Text variant="caption">今週のLLM推論はまだありません</Text>
          <span className="weekly-summary__empty-hint">
            <Text variant="caption">「LLM推論を実行」でノートを自動分類できます</Text>
          </span>
        </div>
      )}

      {/* アクションボタン */}
      <div className="weekly-summary__actions">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowInferenceModal(true)}
          disabled={!ollamaReady || executing}
        >
          {executing ? '推論中...' : 'LLM推論を実行'}
        </Button>
        {stats.autoAppliedMid > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReviewModalMode('auto_applied_notified')}
          >
            確認推奨 ({stats.autoAppliedMid})
          </Button>
        )}
        {stats.pendingCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReviewModalMode('pending')}
          >
            保留中 ({stats.pendingCount})
          </Button>
        )}
      </div>

      {/* Ollama停止時のメッセージ */}
      {!ollamaReady && health && (
        <div className="weekly-summary__warning">
          <Text variant="caption">{health.message}</Text>
        </div>
      )}

      {/* モーダル */}
      {showInferenceModal && (
        <LlmInferenceModal
          onClose={() => setShowInferenceModal(false)}
          onComplete={() => {
            setShowInferenceModal(false)
            reload()
          }}
        />
      )}
      {reviewModalMode && (
        <PendingReviewModal
          mode={reviewModalMode}
          onClose={() => {
            setReviewModalMode(null)
            reload()
          }}
          onNoteClick={onNoteClick}
        />
      )}
    </div>
  )
}
