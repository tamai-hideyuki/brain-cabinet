/**
 * 保留中レビューモーダル
 *
 * LLM推論の保留中結果を確認・承認・却下する
 */

import { useState } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import { usePendingResults } from '../../../hooks/useLlmInference'
import type { NoteType } from '../../../types/note'
import type { PendingItem } from '../../../types/llmInference'
import './PendingReviewModal.css'

type PendingReviewModalProps = {
  onClose: () => void
  onNoteClick?: (noteId: string) => void
}

const NOTE_TYPES: NoteType[] = ['decision', 'learning', 'scratch', 'emotion', 'log']

const getTypeLabel = (type: NoteType): string => {
  const labels: Record<NoteType, string> = {
    decision: '判断',
    learning: '学習',
    scratch: '未整理',
    emotion: '感情',
    log: '記録',
  }
  return labels[type] || type
}

export const PendingReviewModal = ({ onClose, onNoteClick }: PendingReviewModalProps) => {
  const { pending, loading, error, approve, reject, override } = usePendingResults()
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null)
  const [overrideType, setOverrideType] = useState<NoteType | null>(null)

  const handleApprove = async (item: PendingItem) => {
    setProcessingId(item.id)
    try {
      await approve(item.id)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (item: PendingItem) => {
    setProcessingId(item.id)
    try {
      await reject(item.id)
    } finally {
      setProcessingId(null)
    }
  }

  const handleOverride = async () => {
    if (!selectedItem || !overrideType) return
    setProcessingId(selectedItem.id)
    try {
      await override(selectedItem.id, overrideType)
      setSelectedItem(null)
      setOverrideType(null)
    } finally {
      setProcessingId(null)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="pending-modal__backdrop" onClick={handleBackdropClick}>
      <div className="pending-modal">
        <header className="pending-modal__header">
          <Text variant="subtitle">保留中の分類を確認</Text>
          <button
            className="pending-modal__close"
            onClick={onClose}
            aria-label="閉じる"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {loading ? (
          <div className="pending-modal__loading">
            <Spinner size="md" />
            <Text variant="body">読み込み中...</Text>
          </div>
        ) : error ? (
          <div className="pending-modal__error">
            <Text variant="caption">{error}</Text>
          </div>
        ) : !pending || pending.count === 0 ? (
          <div className="pending-modal__empty">
            <Text variant="body">保留中の分類はありません</Text>
          </div>
        ) : selectedItem ? (
          // 上書きタイプ選択画面
          <div className="pending-modal__override">
            <div className="pending-modal__override-header">
              <Text variant="body">{selectedItem.title}</Text>
              <Text variant="caption">
                AIの提案: {getTypeLabel(selectedItem.suggestedType)}（{Math.round(selectedItem.confidence * 100)}%）
              </Text>
            </div>

            <div className="pending-modal__override-reason">
              <Text variant="caption">AIの理由:</Text>
              <Text variant="body">{selectedItem.reasoning}</Text>
            </div>

            <div className="pending-modal__type-select">
              <Text variant="caption">正しいタイプを選択:</Text>
              <div className="pending-modal__type-options">
                {NOTE_TYPES.map((type) => (
                  <button
                    key={type}
                    className={`pending-modal__type-option ${overrideType === type ? 'pending-modal__type-option--selected' : ''}`}
                    onClick={() => setOverrideType(type)}
                  >
                    <Badge
                      variant={
                        type === 'decision'
                          ? 'decision'
                          : type === 'learning'
                          ? 'learning'
                          : 'default'
                      }
                    >
                      {getTypeLabel(type)}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="pending-modal__override-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedItem(null)
                  setOverrideType(null)
                }}
              >
                戻る
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOverride}
                disabled={!overrideType || processingId === selectedItem.id}
              >
                {processingId === selectedItem.id ? '保存中...' : 'この分類で保存'}
              </Button>
            </div>
          </div>
        ) : (
          // 保留一覧
          <div className="pending-modal__list">
            <div className="pending-modal__info">
              <Text variant="caption">
                AIによる分類提案です。確認して承認・却下・修正してください。
              </Text>
            </div>

            {pending.items.map((item) => (
              <div key={item.id} className="pending-modal__item">
                <button
                  className="pending-modal__item-title"
                  onClick={() => onNoteClick?.(item.noteId)}
                >
                  <Text variant="body" truncate>
                    {item.title}
                  </Text>
                </button>

                <div className="pending-modal__item-suggestion">
                  <div className="pending-modal__item-change">
                    <Badge variant="default">{getTypeLabel(item.currentType)}</Badge>
                    <span className="pending-modal__arrow">→</span>
                    <Badge
                      variant={
                        item.suggestedType === 'decision'
                          ? 'decision'
                          : item.suggestedType === 'learning'
                          ? 'learning'
                          : 'default'
                      }
                    >
                      {getTypeLabel(item.suggestedType)}
                    </Badge>
                  </div>
                  <Text variant="caption">
                    {Math.round(item.confidence * 100)}%
                  </Text>
                </div>

                <div className="pending-modal__item-reason">
                  <Text variant="caption">{item.reasoning}</Text>
                </div>

                <div className="pending-modal__item-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(item)}
                    disabled={processingId === item.id}
                  >
                    {processingId === item.id ? '処理中...' : '承認'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleReject(item)}
                    disabled={processingId === item.id}
                  >
                    却下
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedItem(item)}
                    disabled={processingId === item.id}
                  >
                    修正
                  </Button>
                </div>
              </div>
            ))}

            {pending.count > pending.items.length && (
              <div className="pending-modal__more">
                <Text variant="caption">
                  他 {pending.count - pending.items.length}件
                </Text>
              </div>
            )}
          </div>
        )}

        <footer className="pending-modal__footer">
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </footer>
      </div>
    </div>
  )
}
