import { useState, useCallback } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { createNote } from '../../../api/notesApi'
import './CreateNoteModal.css'

type CreateNoteModalProps = {
  onClose: () => void
  onCreated: () => void
}

export const CreateNoteModal = ({ onClose, onCreated }: CreateNoteModalProps) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    setSaving(true)
    setError(null)
    try {
      await createNote(title.trim(), content.trim())
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }, [title, content, onCreated, onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !saving) {
      onClose()
    }
  }

  return (
    <div className="create-note-modal__backdrop" onClick={handleBackdropClick}>
      <div className="create-note-modal">
        <header className="create-note-modal__header">
          <Text variant="subtitle">新規ノート作成</Text>
          <button
            className="create-note-modal__close"
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

        <form className="create-note-modal__form" onSubmit={handleSubmit}>
          {error && (
            <div className="create-note-modal__error">
              <Text variant="caption">{error}</Text>
            </div>
          )}

          <div className="create-note-modal__field">
            <label htmlFor="note-title" className="create-note-modal__label">
              タイトル
            </label>
            <input
              id="note-title"
              type="text"
              className="create-note-modal__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ノートのタイトル"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="create-note-modal__field">
            <label htmlFor="note-content" className="create-note-modal__label">
              内容
            </label>
            <textarea
              id="note-content"
              className="create-note-modal__textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="ノートの内容を入力..."
              rows={8}
              disabled={saving}
            />
          </div>

          <div className="create-note-modal__actions">
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
              {saving ? <Spinner size="sm" /> : '作成'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
