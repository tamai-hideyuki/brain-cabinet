import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { TagList } from '../TagList'
import type { Note, PromotionCandidate } from '../../../types/note'
import './NoteCard.css'

type NoteCardProps = {
  note: Note
  onClick: () => void
  promotionCandidate?: PromotionCandidate
}

const getCategoryBadgeVariant = (category: string | null): 'decision' | 'learning' | 'default' => {
  if (category === '判断' || category === 'decision') return 'decision'
  if (category === '学習' || category === 'learning') return 'learning'
  return 'default'
}

const getSuggestedTypeLabel = (suggestedType: string): string => {
  if (suggestedType === 'decision') return '判断'
  if (suggestedType === 'learning') return '学習'
  return suggestedType
}

export const NoteCard = ({ note, onClick, promotionCandidate }: NoteCardProps) => {
  const isDecision = note.category === '判断' || note.category === 'decision'
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000) // 秒→ミリ秒に変換
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getPreview = (content: string, maxLength = 120) => {
    const text = content.replace(/[#*`_\[\]]/g, '').trim()
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  const cardClassName = isDecision ? 'note-card note-card--decision' : 'note-card'

  return (
    <article className={cardClassName} onClick={onClick}>
      <div className="note-card__header">
        <Text variant="title" truncate>
          {note.title}
        </Text>
      </div>
      <div className="note-card__id">
        <Text variant="caption">{note.id}</Text>
      </div>
      <div className="note-card__body">
        <Text variant="body" lines={2}>
          {getPreview(note.content)}
        </Text>
      </div>
      <div className="note-card__footer">
        <div className="note-card__meta">
          {note.category && (
            <Badge variant={getCategoryBadgeVariant(note.category)}>{note.category}</Badge>
          )}
          {promotionCandidate && (
            <Badge variant="promotion" title={promotionCandidate.reason}>
              昇格候補 → {getSuggestedTypeLabel(promotionCandidate.suggestedType)}
            </Badge>
          )}
          <Text variant="caption">{formatDate(note.updatedAt)}</Text>
        </div>
        {note.tags.length > 0 && <TagList tags={note.tags} max={3} />}
      </div>
    </article>
  )
}
