import { ReviewCard } from '../../molecules/ReviewCard'
import { Spinner } from '../../atoms/Spinner'
import { Text } from '../../atoms/Text'
import type { ReviewItem, ReviewListResponse } from '../../../types/review'
import './ReviewList.css'

type ReviewListProps = {
  data: ReviewListResponse | null
  loading: boolean
  error: string | null
  onItemClick: (noteId: string) => void
  onRemove?: (noteId: string) => void
  removingId?: string | null
}

type ReviewGroupProps = {
  label: string
  items: ReviewItem[]
  variant?: 'danger' | 'warning' | 'default'
  onItemClick: (noteId: string) => void
  onRemove?: (noteId: string) => void
  removingId?: string | null
}

const ReviewGroup = ({ label, items, variant = 'default', onItemClick, onRemove, removingId }: ReviewGroupProps) => {
  if (items.length === 0) return null

  return (
    <section className={`review-group review-group--${variant}`}>
      <div className="review-group__header">
        <Text variant="subtitle">{label}</Text>
        <Text variant="caption">{items.length}件</Text>
      </div>
      <div className="review-group__items">
        {items.map((item) => (
          <ReviewCard
            key={item.noteId}
            item={item}
            onClick={() => onItemClick(item.noteId)}
            onRemove={onRemove}
            removing={removingId === item.noteId}
          />
        ))}
      </div>
    </section>
  )
}

export const ReviewList = ({ data, loading, error, onItemClick, onRemove, removingId }: ReviewListProps) => {
  if (loading) {
    return (
      <div className="review-list__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="review-list__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="review-list__empty">
        <Text variant="body">レビュー予定はありません</Text>
      </div>
    )
  }

  return (
    <div className="review-list">
      <ReviewGroup
        label="期限切れ"
        items={data.overdue}
        variant="danger"
        onItemClick={onItemClick}
        onRemove={onRemove}
        removingId={removingId}
      />
      <ReviewGroup
        label="今日"
        items={data.today}
        variant="warning"
        onItemClick={onItemClick}
        onRemove={onRemove}
        removingId={removingId}
      />
      <ReviewGroup
        label="明日"
        items={data.tomorrow}
        onItemClick={onItemClick}
        onRemove={onRemove}
        removingId={removingId}
      />
      <ReviewGroup
        label="今週"
        items={data.thisWeek}
        onItemClick={onItemClick}
        onRemove={onRemove}
        removingId={removingId}
      />
      <ReviewGroup
        label="それ以降"
        items={data.later}
        onItemClick={onItemClick}
        onRemove={onRemove}
        removingId={removingId}
      />
    </div>
  )
}
