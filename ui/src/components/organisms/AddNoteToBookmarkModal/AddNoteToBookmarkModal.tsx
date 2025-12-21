import { useState, useCallback } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { SearchBox } from '../../molecules/SearchBox'
import { Spinner } from '../../atoms/Spinner'
import { searchNotes } from '../../../api/notesApi'
import type { Note } from '../../../types/note'
import './AddNoteToBookmarkModal.css'

type AddNoteToBookmarkModalProps = {
  folderName: string
  onClose: () => void
  onAdd: (noteId: string, noteName: string) => Promise<void>
}

export const AddNoteToBookmarkModal = ({
  folderName,
  onClose,
  onAdd,
}: AddNoteToBookmarkModalProps) => {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!search.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const notes = await searchNotes(search, 'keyword')
      setResults(notes)
    } catch (e) {
      setError(e instanceof Error ? e.message : '検索に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [search])

  const handleAdd = useCallback(async (note: Note) => {
    setAddingId(note.id)
    setError(null)
    try {
      await onAdd(note.id, note.title)
      // 成功したらリストから削除（追加済み表示のため）
      setResults(prev => prev.filter(n => n.id !== note.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '追加に失敗しました')
    } finally {
      setAddingId(null)
    }
  }, [onAdd])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="add-note-bookmark-modal__backdrop" onClick={handleBackdropClick}>
      <div className="add-note-bookmark-modal">
        <header className="add-note-bookmark-modal__header">
          <div className="add-note-bookmark-modal__header-text">
            <Text variant="subtitle">メモを追加</Text>
            <Text variant="caption">フォルダ: {folderName}</Text>
          </div>
          <button className="add-note-bookmark-modal__close" onClick={onClose} aria-label="閉じる">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="add-note-bookmark-modal__search">
          <SearchBox
            value={search}
            onChange={setSearch}
            onSearch={handleSearch}
            placeholder="メモを検索..."
          />
        </div>

        {error && (
          <div className="add-note-bookmark-modal__error">
            <Text variant="caption">{error}</Text>
          </div>
        )}

        <div className="add-note-bookmark-modal__results">
          {loading ? (
            <div className="add-note-bookmark-modal__loading">
              <Spinner size="md" />
            </div>
          ) : results.length > 0 ? (
            <ul className="add-note-bookmark-modal__list">
              {results.map((note) => (
                <li key={note.id} className="add-note-bookmark-modal__item">
                  <div className="add-note-bookmark-modal__item-content">
                    <Text variant="body">{note.title}</Text>
                    {note.category && (
                      <span className="add-note-bookmark-modal__category">{note.category}</span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAdd(note)}
                    disabled={addingId === note.id}
                  >
                    {addingId === note.id ? '追加中...' : '追加'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : search.trim() ? (
            <div className="add-note-bookmark-modal__empty">
              <Text variant="caption">メモが見つかりませんでした</Text>
            </div>
          ) : (
            <div className="add-note-bookmark-modal__empty">
              <Text variant="caption">メモ名を検索してください</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
