import { useState } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import type {
  StartReviewResult,
  SubmitReviewResult,
  RecallQuestion,
  IntervalPreview,
} from '../../../types/review'
import { QUALITY_RATINGS } from '../../../types/review'
import './ReviewSession.css'

type ReviewSessionProps = {
  session: StartReviewResult
  submitting: boolean
  result: SubmitReviewResult | null
  onSubmit: (quality: number, questionsAttempted?: number, questionsCorrect?: number) => void
  onClose: () => void
  onNext?: () => void
}

const QuestionTypeLabel: Record<string, string> = {
  recall: '想起',
  concept: '概念理解',
  reasoning: '推論',
  application: '応用',
  comparison: '比較',
}

const QuestionCard = ({
  question,
  index,
  showAnswer,
  onToggle,
}: {
  question: RecallQuestion
  index: number
  showAnswer: boolean
  onToggle: () => void
}) => {
  return (
    <div className="review-session__question">
      <div className="review-session__question-header">
        <Badge variant="default">{QuestionTypeLabel[question.questionType] || question.questionType}</Badge>
        <Text variant="caption">Q{index + 1}</Text>
      </div>
      <Text variant="body">{question.question}</Text>
      {question.expectedKeywords.length > 0 && (
        <button
          className="review-session__hint-toggle"
          onClick={onToggle}
        >
          {showAnswer ? 'ヒントを隠す' : 'ヒントを表示'}
        </button>
      )}
      {showAnswer && question.expectedKeywords.length > 0 && (
        <div className="review-session__keywords">
          <Text variant="caption">キーワード:</Text>
          <div className="review-session__keyword-list">
            {question.expectedKeywords.map((kw, i) => (
              <span key={i} className="review-session__keyword">{kw}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const IntervalPreviewCard = ({ preview }: { preview: IntervalPreview }) => {
  return (
    <div className={`review-session__preview review-session__preview--q${preview.quality}`}>
      <div className="review-session__preview-quality">
        <span className="review-session__preview-value">{preview.quality}</span>
        <span className="review-session__preview-label">{preview.qualityLabel}</span>
      </div>
      <div className="review-session__preview-interval">
        {preview.nextIntervalLabel}
      </div>
    </div>
  )
}

const QualityButton = ({
  rating,
  selected,
  onClick,
}: {
  rating: typeof QUALITY_RATINGS[number]
  selected: boolean
  onClick: () => void
}) => {
  return (
    <button
      className={`review-session__quality-btn review-session__quality-btn--${rating.color} ${
        selected ? 'review-session__quality-btn--selected' : ''
      }`}
      onClick={onClick}
    >
      <span className="review-session__quality-value">{rating.value}</span>
      <span className="review-session__quality-label">{rating.label}</span>
      <span className="review-session__quality-desc">{rating.description}</span>
    </button>
  )
}

export const ReviewSession = ({
  session,
  submitting,
  result,
  onSubmit,
  onClose,
  onNext,
}: ReviewSessionProps) => {
  const [showContent, setShowContent] = useState(false)
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({})
  const [selectedQuality, setSelectedQuality] = useState<number | null>(null)

  const toggleAnswer = (questionId: number) => {
    setShowAnswers((prev) => ({ ...prev, [questionId]: !prev[questionId] }))
  }

  const handleSubmit = () => {
    if (selectedQuality === null) return
    onSubmit(selectedQuality, session.questions.length)
  }

  // Show result after submission
  if (result) {
    return (
      <div className="review-session">
        <div className="review-session__result">
          <div className="review-session__result-icon">✓</div>
          <Text variant="title">レビュー完了</Text>
          <Text variant="body">{result.message}</Text>
          <div className="review-session__result-next">
            <Text variant="subtitle">次回レビュー: {result.nextReviewIn}</Text>
          </div>
          <div className="review-session__result-actions">
            {onNext && (
              <Button variant="primary" onClick={onNext}>
                次のレビューへ
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="review-session">
      <div className="review-session__header">
        <div className="review-session__title">
          <Badge variant={session.noteType === 'decision' ? 'decision' : 'learning'}>
            {session.noteType}
          </Badge>
          <Text variant="title">{session.noteTitle}</Text>
        </div>
        <button className="review-session__close" onClick={onClose}>×</button>
      </div>

      {/* Questions Section */}
      <div className="review-session__section">
        <Text variant="subtitle">Active Recall 質問</Text>
        <div className="review-session__questions">
          {session.questions.length > 0 ? (
            session.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                showAnswer={!!showAnswers[q.id]}
                onToggle={() => toggleAnswer(q.id)}
              />
            ))
          ) : (
            <Text variant="caption">このノートには質問がありません</Text>
          )}
        </div>
      </div>

      {/* Note Content (collapsible) */}
      <div className="review-session__section">
        <button
          className="review-session__content-toggle"
          onClick={() => setShowContent(!showContent)}
        >
          <Text variant="subtitle">ノート内容</Text>
          <span>{showContent ? '▼' : '▶'}</span>
        </button>
        {showContent && (
          <div className="review-session__content">
            <pre>{session.noteContent}</pre>
          </div>
        )}
      </div>

      {/* Interval Preview */}
      <div className="review-session__section">
        <Text variant="subtitle">評価による次回レビュー</Text>
        <div className="review-session__previews">
          {session.previewIntervals.map((preview) => (
            <IntervalPreviewCard key={preview.quality} preview={preview} />
          ))}
        </div>
      </div>

      {/* Quality Rating */}
      <div className="review-session__section">
        <Text variant="subtitle">自己評価</Text>
        <div className="review-session__quality-grid">
          {QUALITY_RATINGS.map((rating) => (
            <QualityButton
              key={rating.value}
              rating={rating}
              selected={selectedQuality === rating.value}
              onClick={() => setSelectedQuality(rating.value)}
            />
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="review-session__actions">
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={selectedQuality === null || submitting}
        >
          {submitting ? <Spinner size="sm" /> : '評価を送信'}
        </Button>
      </div>
    </div>
  )
}
