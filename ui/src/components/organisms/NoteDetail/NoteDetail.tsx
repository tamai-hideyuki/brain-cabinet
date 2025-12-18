import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { TagList } from '../../molecules/TagList'
import { Spinner } from '../../atoms/Spinner'
import type { Note } from '../../../types/note'
import './NoteDetail.css'

type NoteDetailProps = {
  note: Note | null
  loading: boolean
  error: string | null
}

export const NoteDetail = ({ note, loading, error }: NoteDetailProps) => {
  if (loading) {
    return (
      <div class="note-detail__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div class="note-detail__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (!note) {
    return (
      <div class="note-detail__empty">
        <Text variant="body">ノートが見つかりませんでした</Text>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000) // 秒→ミリ秒に変換
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <article class="note-detail">
      <header class="note-detail__header">
        <Text variant="title">{note.title}</Text>
        <div class="note-detail__id">
          <Text variant="caption">{note.id}</Text>
        </div>
        <div class="note-detail__meta">
          {note.category && <Badge variant="primary">{note.category}</Badge>}
          <Text variant="caption">更新: {formatDate(note.updatedAt)}</Text>
          <Text variant="caption">作成: {formatDate(note.createdAt)}</Text>
        </div>
        {note.tags.length > 0 && <TagList tags={note.tags} />}
      </header>
      <div class="note-detail__content">
        <pre>{note.content}</pre>
      </div>
    </article>
  )
}
