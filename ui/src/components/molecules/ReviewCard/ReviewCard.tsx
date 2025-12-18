import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import type { ReviewItem } from '../../../types/review'
import './ReviewCard.css'

type ReviewCardProps = {
  item: ReviewItem
  onClick: () => void
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

export const ReviewCard = ({ item, onClick }: ReviewCardProps) => {
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
    </article>
  )
}
