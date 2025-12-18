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
}

type ReviewGroupProps = {
  label: string
  items: ReviewItem[]
  variant?: 'danger' | 'warning' | 'default'
  onItemClick: (noteId: string) => void
}

const ReviewGroup = ({ label, items, variant = 'default', onItemClick }: ReviewGroupProps) => {
  if (items.length === 0) return null

  return (
    <section class={`review-group review-group--${variant}`}>
      <div class="review-group__header">
        <Text variant="subtitle">{label}</Text>
        <Text variant="caption">{items.length}件</Text>
      </div>
      <div class="review-group__items">
        {items.map((item) => (
          <ReviewCard
            key={item.noteId}
            item={item}
            onClick={() => onItemClick(item.noteId)}
          />
        ))}
      </div>
    </section>
  )
}

export const ReviewList = ({ data, loading, error, onItemClick }: ReviewListProps) => {
  if (loading) {
    return (
      <div class="review-list__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div class="review-list__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div class="review-list__empty">
        <Text variant="body">レビュー予定はありません</Text>
      </div>
    )
  }

  return (
    <div class="review-list">
      <ReviewGroup
        label="期限切れ"
        items={data.overdue}
        variant="danger"
        onItemClick={onItemClick}
      />
      <ReviewGroup
        label="今日"
        items={data.today}
        variant="warning"
        onItemClick={onItemClick}
      />
      <ReviewGroup
        label="明日"
        items={data.tomorrow}
        onItemClick={onItemClick}
      />
      <ReviewGroup
        label="今週"
        items={data.thisWeek}
        onItemClick={onItemClick}
      />
      <ReviewGroup
        label="それ以降"
        items={data.later}
        onItemClick={onItemClick}
      />
    </div>
  )
}
