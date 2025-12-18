import { useState, useCallback } from 'react'
import { MainLayout } from '../../templates/MainLayout'
import { ReviewList } from '../../organisms/ReviewList'
import { ReviewSession } from '../../organisms/ReviewSession'
import { AddToReviewModal } from '../../organisms/AddToReviewModal'
import { useReviews } from '../../../hooks/useReviews'
import { useReviewSession } from '../../../hooks/useReviewSession'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { cancelReview } from '../../../api/reviewApi'
import type { ReviewItem } from '../../../types/review'
import './ReviewsPage.css'

export const ReviewsPage = () => {
  const { data, loading, error, reload } = useReviews()
  const reviewSession = useReviewSession()
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Get due items (overdue + today)
  const dueItems: ReviewItem[] = data ? [...data.overdue, ...data.today] : []

  const handleStartReview = useCallback(async (noteId: string) => {
    setActiveNoteId(noteId)
    await reviewSession.start(noteId)
  }, [reviewSession])

  const handleCloseSession = useCallback(() => {
    setActiveNoteId(null)
    reviewSession.reset()
    reload()
  }, [reviewSession, reload])

  const handleNextReview = useCallback(async () => {
    // Find next due item
    const currentIndex = dueItems.findIndex((item) => item.noteId === activeNoteId)
    const nextItem = dueItems[currentIndex + 1]

    if (nextItem) {
      reviewSession.reset()
      setActiveNoteId(nextItem.noteId)
      await reviewSession.start(nextItem.noteId)
    } else {
      handleCloseSession()
    }
  }, [dueItems, activeNoteId, reviewSession, handleCloseSession])

  const handleSubmit = useCallback(
    (quality: number, questionsAttempted?: number, questionsCorrect?: number) => {
      reviewSession.submit(quality, questionsAttempted, questionsCorrect)
    },
    [reviewSession]
  )

  const handleRemove = useCallback(async (noteId: string) => {
    setRemovingId(noteId)
    try {
      await cancelReview(noteId)
      reload()
    } catch (e) {
      console.error('Failed to remove from review list:', e)
    } finally {
      setRemovingId(null)
    }
  }, [reload])

  const handleAddSuccess = useCallback(() => {
    setShowAddModal(false)
    reload()
  }, [reload])

  // Show review session modal
  if (activeNoteId && (reviewSession.session || reviewSession.loading)) {
    return (
      <MainLayout>
        <div className="reviews-page">
          {reviewSession.loading ? (
            <div className="reviews-page__loading">
              <Spinner size="lg" />
              <Text variant="body">レビューを準備中...</Text>
            </div>
          ) : reviewSession.session ? (
            <ReviewSession
              session={reviewSession.session}
              submitting={reviewSession.submitting}
              result={reviewSession.result}
              onSubmit={handleSubmit}
              onClose={handleCloseSession}
              onNext={dueItems.length > 1 ? handleNextReview : undefined}
            />
          ) : reviewSession.error ? (
            <div className="reviews-page__error">
              <Text variant="body">{reviewSession.error}</Text>
              <Button variant="secondary" onClick={handleCloseSession}>
                戻る
              </Button>
            </div>
          ) : null}
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="reviews-page">
        <div className="reviews-page__header">
          <div className="reviews-page__title">
            <Text variant="title">レビュー予定</Text>
            {data && <Text variant="caption">{data.total} 件</Text>}
          </div>
          <div className="reviews-page__actions">
            {dueItems.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStartReview(dueItems[0].noteId)}
              >
                レビュー開始
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setShowAddModal(true)}>
              追加
            </Button>
            <Button variant="secondary" size="sm" onClick={reload} disabled={loading}>
              更新
            </Button>
          </div>
        </div>

        {dueItems.length > 0 && (
          <div className="reviews-page__due-summary">
            <Text variant="body">
              今日レビューすべきノート: <strong>{dueItems.length}</strong> 件
              {data?.overdue.length ? ` (うち期限切れ: ${data.overdue.length} 件)` : ''}
            </Text>
          </div>
        )}

        <ReviewList
          data={data}
          loading={loading}
          error={error}
          onItemClick={handleStartReview}
          onRemove={handleRemove}
          removingId={removingId}
        />

        {showAddModal && (
          <AddToReviewModal
            onClose={() => setShowAddModal(false)}
            onSuccess={handleAddSuccess}
          />
        )}
      </div>
    </MainLayout>
  )
}
