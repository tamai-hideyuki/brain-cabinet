/**
 * 週次LLM推論サマリーセクション
 *
 * Dashboard内に表示する週次サマリーコンポーネント
 */

import { useState } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { useWeeklySummary, useOllamaHealth, useLlmExecute } from '../../../hooks/useLlmInference'
import { LlmInferenceModal } from '../LlmInferenceModal'
import { PendingReviewModal } from '../PendingReviewModal'
import './WeeklySummarySection.css'

type WeeklySummarySectionProps = {
  onNoteClick?: (noteId: string) => void
}

export const WeeklySummarySection = ({ onNoteClick }: WeeklySummarySectionProps) => {
  const { summary, loading, error, reload } = useWeeklySummary()
  const { health } = useOllamaHealth()
  const { executing, execute } = useLlmExecute()
  const [showInferenceModal, setShowInferenceModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)

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

  // Ollamaが利用可能かどうか
  const ollamaReady = health?.available && health?.modelLoaded

  return (
    <div className="weekly-summary">
      <div className="weekly-summary__header">
        <div className="weekly-summary__title">
          <Text variant="subtitle">LLM推論サマリー</Text>
          <Badge variant={ollamaReady ? 'learning' : 'default'}>
            {ollamaReady ? 'Ollama準備完了' : 'Ollama停止中'}
          </Badge>
        </div>
        <Text variant="caption">
          {summary.weekStart} 〜 {summary.weekEnd}
        </Text>
      </div>

      {hasActivity ? (
        <>
          {/* 統計 */}
          <div className="weekly-summary__stats">
            <div className="weekly-summary__stat">
              <span className="weekly-summary__stat-number">{totalProcessed}</span>
              <Text variant="caption">自動反映</Text>
            </div>
            <div className="weekly-summary__stat">
              <span className="weekly-summary__stat-number">{stats.pendingCount}</span>
              <Text variant="caption">保留中</Text>
            </div>
            <div className="weekly-summary__stat">
              <span className="weekly-summary__stat-number">{stats.approvedCount + stats.overriddenCount}</span>
              <Text variant="caption">確認済み</Text>
            </div>
          </div>

          {/* 週次通知（中信頼度の自動反映） */}
          {recentAutoApplied.length > 0 && (
            <div className="weekly-summary__recent">
              <Text variant="caption">今週の自動分類（確認推奨）:</Text>
              <div className="weekly-summary__list">
                {recentAutoApplied.slice(0, 3).map((item) => (
                  <button
                    key={item.noteId}
                    className="weekly-summary__item"
                    onClick={() => onNoteClick?.(item.noteId)}
                  >
                    <Text variant="body" truncate>
                      {item.title}
                    </Text>
                    <Badge
                      variant={item.type === 'decision' ? 'decision' : item.type === 'learning' ? 'learning' : 'default'}
                    >
                      {item.type}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 保留中 */}
          {pendingItems.length > 0 && (
            <div className="weekly-summary__pending">
              <Text variant="caption">保留中（確認が必要）:</Text>
              <div className="weekly-summary__list">
                {pendingItems.slice(0, 2).map((item) => (
                  <div key={item.id} className="weekly-summary__pending-item">
                    <Text variant="body" truncate>
                      {item.title}
                    </Text>
                    <div className="weekly-summary__pending-suggestion">
                      <Text variant="caption">
                        {item.currentType} → {item.suggestedType}
                      </Text>
                      <Text variant="caption">
                        ({Math.round(item.confidence * 100)}%)
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="weekly-summary__empty">
          <Text variant="caption">今週のLLM推論はまだありません</Text>
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
        {stats.pendingCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPendingModal(true)}
          >
            保留中を確認 ({stats.pendingCount})
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
      {showPendingModal && (
        <PendingReviewModal
          onClose={() => {
            setShowPendingModal(false)
            reload()
          }}
          onNoteClick={onNoteClick}
        />
      )}
    </div>
  )
}
