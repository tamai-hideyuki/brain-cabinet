import { useState, useCallback, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { updateNote } from '../../../api/notesApi'
import type { Note } from '../../../types/note'
import './EditNoteModal.css'

type EditNoteModalProps = {
  note: Note
  onClose: () => void
  onUpdated: () => void
}

export const EditNoteModal = ({ note, onClose, onUpdated }: EditNoteModalProps) => {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
  }, [note])

  const hasChanges = title !== note.title || content !== note.content

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError('タイトルを入力してください')
      return
    }
    if (!content.trim()) {
      setError('内容を入力してください')
      return
    }

    if (!hasChanges) {
      onClose()
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateNote(note.id, title.trim(), content.trim())
      onUpdated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }, [note.id, title, content, hasChanges, onUpdated, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !saving) {
      onClose()
    }
  }

  return (
    <div className="edit-note-modal__backdrop" onClick={handleBackdropClick}>
      <div className="edit-note-modal">
        <header className="edit-note-modal__header">
          <Text variant="subtitle">ノートを編集</Text>
          <button
            className="edit-note-modal__close"
            onClick={onClose}
            aria-label="閉じる"
            disabled={saving}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form className="edit-note-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="edit-note-modal__error">
              <Text variant="caption">{error}</Text>
            </div>
          )}

          <div className="edit-note-modal__field">
            <label htmlFor="edit-note-title" className="edit-note-modal__label">
              タイトル
            </label>
            <input
              id="edit-note-title"
              type="text"
              className="edit-note-modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ノートのタイトル"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="edit-note-modal__field">
            <label htmlFor="edit-note-content" className="edit-note-modal__label">
              内容
            </label>
            <textarea
              id="edit-note-content"
              className="edit-note-modal__textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="ノートの内容を入力..."
              rows={12}
              disabled={saving}
            />
          </div>

          <div className="edit-note-modal__actions">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
            >
              {saving ? <Spinner size="sm" /> : hasChanges ? '保存' : '閉じる'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
