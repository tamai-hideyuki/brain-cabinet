import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { TagList } from '../TagList'
import type { Note } from '../../../types/note'
import './NoteCard.css'

type NoteCardProps = {
  note: Note
  onClick: () => void
}

export const NoteCard = ({ note, onClick }: NoteCardProps) => {
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

  return (
    <article class="note-card" onClick={onClick}>
      <div class="note-card__header">
        <Text variant="title" truncate>
          {note.title}
        </Text>
      </div>
      <div class="note-card__id">
        <Text variant="caption">{note.id}</Text>
      </div>
      <div class="note-card__body">
        <Text variant="body" lines={2}>
          {getPreview(note.content)}
        </Text>
      </div>
      <div class="note-card__footer">
        <div class="note-card__meta">
          {note.category && <Badge variant="primary">{note.category}</Badge>}
          <Text variant="caption">{formatDate(note.updatedAt)}</Text>
        </div>
        {note.tags.length > 0 && <TagList tags={note.tags} max={3} />}
      </div>
    </article>
  )
}
