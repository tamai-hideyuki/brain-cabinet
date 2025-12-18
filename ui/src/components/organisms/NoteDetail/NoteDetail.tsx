import { useState } from 'preact/hooks'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { TagList } from '../../molecules/TagList'
import { Spinner } from '../../atoms/Spinner'
import type { Note, NoteHistory } from '../../../types/note'
import './NoteDetail.css'

type NoteDetailProps = {
  note: Note | null
  history: NoteHistory[]
  loading: boolean
  historyLoading: boolean
  error: string | null
  onLoadHistory: () => void
}

export const NoteDetail = ({
  note,
  history,
  loading,
  historyLoading,
  error,
  onLoadHistory,
}: NoteDetailProps) => {
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)

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

  const handleLoadHistory = () => {
    if (!historyLoaded) {
      onLoadHistory()
      setHistoryLoaded(true)
    }
  }

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistoryId(expandedHistoryId === id ? null : id)
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

      <section class="note-detail__history">
        <div class="note-detail__history-header">
          <Text variant="subtitle">更新履歴</Text>
          {!historyLoaded && (
            <Button variant="secondary" size="sm" onClick={handleLoadHistory} disabled={historyLoading}>
              {historyLoading ? '読み込み中...' : '履歴を読み込む'}
            </Button>
          )}
        </div>
        {historyLoaded && history.length === 0 && (
          <Text variant="caption">履歴はありません</Text>
        )}
        {history.length > 0 && (
          <div class="note-detail__history-list">
            {history.map((h, index) => (
              <div key={h.id} class="note-detail__history-item">
                <div
                  class="note-detail__history-item-header"
                  onClick={() => toggleHistoryExpand(h.id)}
                >
                  <div class="note-detail__history-item-info">
                    <Text variant="caption">#{history.length - index}</Text>
                    <Text variant="caption">{formatDate(h.createdAt)}</Text>
                    <span class="note-detail__history-id">{h.id}</span>
                  </div>
                  <Text variant="caption">{expandedHistoryId === h.id ? '▼' : '▶'}</Text>
                </div>
                {expandedHistoryId === h.id && (
                  <div class="note-detail__history-item-content">
                    <pre>{h.content}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
