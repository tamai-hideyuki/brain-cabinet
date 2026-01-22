import { useState, useCallback, useRef, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { TagList } from '../../molecules/TagList'
import { Spinner } from '../../atoms/Spinner'
import { DiffView } from '../../atoms/DiffView'
import { InfluenceSection } from '../../molecules/InfluenceSection'
import { BlockEditor } from '../BlockEditor'
import { updateNote } from '../../../api/notesApi'
import type { Note, NoteHistory } from '../../../types/note'
import type { NoteInfluence } from '../../../types/influence'
import './NoteDetail.css'

const getCategoryBadgeVariant = (category: string | null): 'decision' | 'learning' | 'default' => {
  if (category === '判断' || category === 'decision') return 'decision'
  if (category === '学習' || category === 'learning') return 'learning'
  return 'default'
}

type NoteDetailProps = {
  note: Note | null
  history: NoteHistory[]
  loading: boolean
  historyLoading: boolean
  error: string | null
  onLoadHistory: () => void
  influence: NoteInfluence | null
  influenceLoading: boolean
  onInfluenceNoteClick: (noteId: string) => void
  onEdit: () => void
  onAddBookmark?: () => void
  bookmarkAdding?: boolean
  onAddLink?: (noteId: string, noteTitle: string) => void
  addingLinkNoteId?: string | null
  onDelete?: () => void
  deleting?: boolean
}

export const NoteDetail = ({
  note,
  history,
  loading,
  historyLoading,
  error,
  onLoadHistory,
  influence,
  influenceLoading,
  onInfluenceNoteClick,
  onEdit,
  onAddBookmark,
  bookmarkAdding,
  onAddLink,
  addingLinkNoteId,
  onDelete,
  deleting,
}: NoteDetailProps) => {
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const pendingContentRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const lastSavedContentRef = useRef<string | null>(null)

  // Initialize last saved content when note loads
  useEffect(() => {
    if (note) {
      lastSavedContentRef.current = note.content
    }
  }, [note?.id]) // Only reset when note ID changes

  // Auto-save with debounce
  const handleContentChange = useCallback(
    (markdown: string) => {
      if (!note) return

      // Skip if content hasn't actually changed from last saved
      if (markdown === lastSavedContentRef.current) {
        return
      }

      pendingContentRef.current = markdown

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }

      // Set new timeout for auto-save (1.5 seconds debounce)
      saveTimeoutRef.current = window.setTimeout(async () => {
        if (pendingContentRef.current === null) return
        if (pendingContentRef.current === lastSavedContentRef.current) return

        setSaveStatus('saving')
        try {
          await updateNote(note.id, note.title, pendingContentRef.current)
          lastSavedContentRef.current = pendingContentRef.current
          setSaveStatus('saved')
          // Don't call onContentUpdated here to avoid page reload and scroll reset
          // Reset status after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (err) {
          console.error('Failed to save note:', err)
          setSaveStatus('error')
        }
      }, 1500)
    },
    [note]
  )

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="note-detail__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="note-detail__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="note-detail__empty">
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
    <article className="note-detail">
      <header className="note-detail__header">
        <div className="note-detail__header-top">
          <Text variant="title">{note.title}</Text>
          <div className="note-detail__actions">
            {onAddBookmark && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddBookmark}
                disabled={bookmarkAdding}
              >
                {bookmarkAdding ? '追加中...' : '+ ブックマーク'}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Markdown編集
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? '削除中...' : '削除'}
              </Button>
            )}
          </div>
        </div>
        <div className="note-detail__id">
          <Text variant="caption">{note.id}</Text>
        </div>
        <div className="note-detail__meta">
          {note.category && (
            <Badge variant={getCategoryBadgeVariant(note.category)}>{note.category}</Badge>
          )}
          <Text variant="caption">更新: {formatDate(note.updatedAt)}</Text>
          <Text variant="caption">作成: {formatDate(note.createdAt)}</Text>
        </div>
        {note.tags.length > 0 && <TagList tags={note.tags} />}
        {saveStatus !== 'idle' && (
          <div className={`note-detail__save-status note-detail__save-status--${saveStatus}`}>
            {saveStatus === 'saving' && '保存中...'}
            {saveStatus === 'saved' && '保存しました'}
            {saveStatus === 'error' && '保存に失敗しました'}
          </div>
        )}
      </header>
      <div className="note-detail__content">
        <BlockEditor
          initialMarkdown={note.content}
          noteId={note.id}
          onChange={handleContentChange}
        />
      </div>

      <section className="note-detail__history">
        <div className="note-detail__history-header">
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
          <div className="note-detail__history-list">
            {history.map((h, index) => {
              // historyは新しい順で並んでいる
              // index === 0 は最新の履歴なので、現在のnote.contentと比較
              // それ以外は、一つ前（より新しい）の履歴と比較
              const nextContent = index === 0 ? note.content : history[index - 1].content

              return (
                <div key={h.id} className="note-detail__history-item">
                  <div
                    className="note-detail__history-item-header"
                    onClick={() => toggleHistoryExpand(h.id)}
                  >
                    <div className="note-detail__history-item-info">
                      <Text variant="caption">#{history.length - index}</Text>
                      <Text variant="caption">{formatDate(h.createdAt)}</Text>
                      <span className="note-detail__history-id">{h.id}</span>
                    </div>
                    <Text variant="caption">{expandedHistoryId === h.id ? '▼' : '▶'}</Text>
                  </div>
                  {expandedHistoryId === h.id && (
                    <div className="note-detail__history-item-content">
                      <DiffView oldText={h.content} newText={nextContent} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <InfluenceSection
        influence={influence}
        loading={influenceLoading}
        onNoteClick={onInfluenceNoteClick}
        onAddLink={onAddLink}
        addingLinkNoteId={addingLinkNoteId}
      />
    </article>
  )
}
