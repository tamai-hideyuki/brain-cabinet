import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { CountdownTimer } from '../../atoms/CountdownTimer'
import type { DeletedNoteWithCountdown } from '../../../hooks/useDeletedNotes'
import './DeletedNoteCard.css'

type Props = {
  note: DeletedNoteWithCountdown
  onRestore: (id: string) => void
  restoring: boolean
}

export const DeletedNoteCard = ({ note, onRestore, restoring }: Props) => {
  const formatDeletedDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPreview = (content: string, maxLength = 100) => {
    const text = content.replace(/[#*`_\[\]]/g, '').trim()
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  return (
    <article className={`deleted-note-card ${note.isExpiringSoon ? 'deleted-note-card--warning' : ''}`}>
      <div className="deleted-note-card__content">
        <div className="deleted-note-card__header">
          <Text variant="title" truncate>
            {note.title}
          </Text>
        </div>
        <div className="deleted-note-card__body">
          <Text variant="body" lines={2}>
            {getPreview(note.snippet)}
          </Text>
        </div>
        <div className="deleted-note-card__meta">
          {note.category && <Badge variant="default">{note.category}</Badge>}
          <Text variant="caption">削除: {formatDeletedDate(note.deletedAt)}</Text>
        </div>
      </div>
      <div className="deleted-note-card__actions">
        <div className="deleted-note-card__countdown">
          <Text variant="caption">完全削除まで</Text>
          <CountdownTimer
            remainingSeconds={note.remainingSeconds}
            isExpiringSoon={note.isExpiringSoon}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onRestore(note.id)}
          disabled={restoring}
        >
          {restoring ? '復元中...' : '復元'}
        </Button>
      </div>
    </article>
  )
}
