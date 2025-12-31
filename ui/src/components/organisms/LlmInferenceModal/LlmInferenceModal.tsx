/**
 * LLM推論実行モーダル
 *
 * 推論候補の確認と実行を行う
 */

import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import { useLlmCandidates, useEstimateCost, useLlmExecute } from '../../../hooks/useLlmInference'
import './LlmInferenceModal.css'

type LlmInferenceModalProps = {
  onClose: () => void
  onComplete: () => void
}

export const LlmInferenceModal = ({ onClose, onComplete }: LlmInferenceModalProps) => {
  const { candidates, loading: candidatesLoading } = useLlmCandidates()
  const { estimate, loading: estimateLoading, load: loadEstimate } = useEstimateCost()
  const { result, executing, error: executeError, execute } = useLlmExecute()
  const [executed, setExecuted] = useState(false)

  useEffect(() => {
    loadEstimate()
  }, [loadEstimate])

  const handleExecute = async () => {
    try {
      await execute()
      setExecuted(true)
    } catch {
      // エラーは useLlmExecute で処理
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !executing) {
      onClose()
    }
  }

  const handleDone = () => {
    onComplete()
  }

  const isLoading = candidatesLoading || estimateLoading

  return (
    <div className="llm-modal__backdrop" onClick={handleBackdropClick}>
      <div className="llm-modal">
        <header className="llm-modal__header">
          <Text variant="subtitle">LLM推論を実行</Text>
          <button
            className="llm-modal__close"
            onClick={onClose}
            disabled={executing}
            aria-label="閉じる"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {isLoading ? (
          <div className="llm-modal__loading">
            <Spinner size="md" />
            <Text variant="body">候補を確認中...</Text>
          </div>
        ) : executed && result ? (
          // 実行完了
          <div className="llm-modal__result">
            <div className="llm-modal__result-header">
              <Text variant="subtitle">{result.executed}件の推論が完了しました</Text>
            </div>
            <div className="llm-modal__result-stats">
              <div className="llm-modal__result-stat">
                <span className="llm-modal__stat-number">
                  {result.results.filter((r) => r.status === 'auto_applied' || r.status === 'auto_applied_notified').length}
                </span>
                <Text variant="caption">自動反映</Text>
              </div>
              <div className="llm-modal__result-stat">
                <span className="llm-modal__stat-number">
                  {result.results.filter((r) => r.status === 'pending').length}
                </span>
                <Text variant="caption">保留</Text>
              </div>
            </div>
            <div className="llm-modal__result-list">
              {result.results.slice(0, 5).map((item) => (
                <div key={item.noteId} className="llm-modal__result-item">
                  <Badge
                    variant={
                      item.type === 'decision'
                        ? 'decision'
                        : item.type === 'learning'
                        ? 'learning'
                        : 'default'
                    }
                  >
                    {item.type}
                  </Badge>
                  <Text variant="caption">
                    {Math.round(item.confidence * 100)}%
                  </Text>
                  <Text variant="caption">
                    {item.status === 'auto_applied'
                      ? '自動反映'
                      : item.status === 'auto_applied_notified'
                      ? '自動反映（通知）'
                      : '保留'}
                  </Text>
                </div>
              ))}
              {result.results.length > 5 && (
                <Text variant="caption">他 {result.results.length - 5}件</Text>
              )}
            </div>
            <div className="llm-modal__actions">
              <Button variant="primary" onClick={handleDone}>
                完了
              </Button>
            </div>
          </div>
        ) : (
          // 実行前
          <>
            {executeError && (
              <div className="llm-modal__error">
                <Text variant="caption">{executeError}</Text>
              </div>
            )}

            <div className="llm-modal__info">
              <Text variant="body">
                AIによるノート分類を実行します。
              </Text>
              <Text variant="caption">
                分類結果は信頼度に基づいて自動反映または保留されます。
              </Text>
            </div>

            {estimate && (
              <div className="llm-modal__estimate">
                <div className="llm-modal__estimate-item">
                  <Text variant="caption">対象ノート数</Text>
                  <span className="llm-modal__stat-number">{estimate.candidateCount}件</span>
                </div>
                <div className="llm-modal__estimate-item">
                  <Text variant="caption">推定時間</Text>
                  <span className="llm-modal__stat-number">
                    {estimate.estimatedTimeSeconds < 60
                      ? `${estimate.estimatedTimeSeconds}秒`
                      : `${Math.ceil(estimate.estimatedTimeSeconds / 60)}分`}
                  </span>
                </div>
                <div className="llm-modal__estimate-item">
                  <Text variant="caption">コスト</Text>
                  <span className="llm-modal__stat-number">$0（ローカル）</span>
                </div>
              </div>
            )}

            {candidates && candidates.count > 0 && (
              <div className="llm-modal__candidates">
                <Text variant="caption">推論候補:</Text>
                <div className="llm-modal__candidate-list">
                  {candidates.candidates.slice(0, 5).map((c) => (
                    <div key={c.noteId} className="llm-modal__candidate-item">
                      <Text variant="body" truncate>
                        {c.title}
                      </Text>
                      <Text variant="caption">{c.reason}</Text>
                    </div>
                  ))}
                  {candidates.count > 5 && (
                    <Text variant="caption">他 {candidates.count - 5}件</Text>
                  )}
                </div>
              </div>
            )}

            <div className="llm-modal__note">
              <Text variant="caption">
                この分類はAIによる提案です。結果は後から確認・修正できます。
              </Text>
            </div>

            <div className="llm-modal__actions">
              <Button variant="secondary" onClick={onClose} disabled={executing}>
                キャンセル
              </Button>
              <Button
                variant="primary"
                onClick={handleExecute}
                disabled={executing || !estimate || estimate.candidateCount === 0}
              >
                {executing ? '推論中...' : '推論を実行'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
