import { useState, useCallback, useEffect, useRef } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { updateNote } from '../../../api/notesApi'
import { uploadNoteImage } from '../../../api/noteImagesApi'
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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
  }, [note])

  const hasChanges = title !== note.title || content !== note.content

  // 画像アップロード処理
  const handleImageUpload = useCallback(async (files: FileList) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (const file of imageFiles) {
        const result = await uploadNoteImage(note.id, file)

        // カーソル位置にMarkdownを挿入
        const textarea = textareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const before = content.substring(0, start)
          const after = content.substring(end)
          const newContent = `${before}\n${result.markdown}\n${after}`
          setContent(newContent)

          // カーソル位置を更新
          setTimeout(() => {
            const newPos = start + result.markdown.length + 2
            textarea.selectionStart = newPos
            textarea.selectionEnd = newPos
            textarea.focus()
          }, 0)
        } else {
          setContent(prev => `${prev}\n${result.markdown}\n`)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像のアップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }, [note.id, content])

  // ドラッグ&ドロップイベント
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleImageUpload(files)
    }
  }, [handleImageUpload])

  // ペーストイベント（クリップボードからの画像）
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))

    if (imageItems.length > 0) {
      e.preventDefault()
      const files = imageItems
        .map(item => item.getAsFile())
        .filter((f): f is File => f !== null)

      if (files.length > 0) {
        const dataTransfer = new DataTransfer()
        files.forEach(f => dataTransfer.items.add(f))
        handleImageUpload(dataTransfer.files)
      }
    }
  }, [handleImageUpload])

  // ファイル選択ハンドラ
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleImageUpload(files)
    }
    // 同じファイルを再選択できるようにリセット
    e.target.value = ''
  }, [handleImageUpload])

  // 画像選択ボタンクリック
  const handleImageButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

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

          <div
            className={`edit-note-modal__field edit-note-modal__field--content ${isDragging ? 'edit-note-modal__field--dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="edit-note-modal__label-row">
              <label htmlFor="edit-note-content" className="edit-note-modal__label">
                内容
                {uploading && <Spinner size="sm" />}
              </label>
              <button
                type="button"
                className="edit-note-modal__image-button"
                onClick={handleImageButtonClick}
                disabled={saving || uploading}
                aria-label="画像を追加"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="edit-note-modal__image-button-text">画像</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="edit-note-modal__file-input"
              />
            </div>
            <textarea
              ref={textareaRef}
              id="edit-note-content"
              className="edit-note-modal__textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="ノートの内容を入力...（画像をドラッグ&ドロップまたは貼り付け可能）"
              rows={12}
              disabled={saving || uploading}
            />
            {isDragging && (
              <div className="edit-note-modal__drop-overlay">
                <Text variant="body">画像をドロップしてアップロード</Text>
              </div>
            )}
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
