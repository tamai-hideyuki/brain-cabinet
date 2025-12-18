import type { MouseEvent } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import type { ReviewItem } from '../../../types/review'
import './ReviewCard.css'

type ReviewCardProps = {
  item: ReviewItem
  onClick: () => void
  onRemove?: (noteId: string) => void
  removing?: boolean
}

const typeVariant = (type: string): 'primary' | 'success' | 'warning' | 'default' => {
  switch (type) {
    case 'decision':
      return 'success'
    case 'learning':
      return 'primary'
    default:
      return 'default'
  }
}

export const ReviewCard = ({ item, onClick, onRemove, removing }: ReviewCardProps) => {
  const handleRemove = (e: MouseEvent) => {
    e.stopPropagation()
    if (onRemove && !removing) {
      onRemove(item.noteId)
    }
  }

  return (
    <article className="review-card" onClick={onClick}>
      <div className="review-card__content">
        <Text variant="subtitle" truncate>
          {item.noteTitle}
        </Text>
        <div className="review-card__id">
          <Text variant="caption">{item.noteId}</Text>
        </div>
        <div className="review-card__meta">
          <Badge variant={typeVariant(item.noteType)}>{item.noteType}</Badge>
          <Text variant="caption">{item.nextReviewIn}</Text>
        </div>
      </div>
      {onRemove && (
        <button
          className="review-card__remove"
          onClick={handleRemove}
          disabled={removing}
          title="リストから外す"
        >
          {removing ? '...' : '×'}
        </button>
      )}
    </article>
  )
}
