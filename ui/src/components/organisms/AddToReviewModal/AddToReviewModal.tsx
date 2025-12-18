import { useState, useCallback } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { SearchBox } from '../../molecules/SearchBox'
import { Spinner } from '../../atoms/Spinner'
import { searchNotes } from '../../../api/notesApi'
import { scheduleReview } from '../../../api/reviewApi'
import type { Note } from '../../../types/note'
import './AddToReviewModal.css'

type AddToReviewModalProps = {
  onClose: () => void
  onSuccess: () => void
}

export const AddToReviewModal = ({ onClose, onSuccess }: AddToReviewModalProps) => {
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

  const handleAdd = useCallback(async (noteId: string) => {
    setAddingId(noteId)
    setError(null)
    try {
      const result = await scheduleReview(noteId, true)
      if (result.success) {
        onSuccess()
      } else {
        setError(result.message || '追加に失敗しました')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '追加に失敗しました')
    } finally {
      setAddingId(null)
    }
  }, [onSuccess])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="add-review-modal__backdrop" onClick={handleBackdropClick}>
      <div className="add-review-modal">
        <header className="add-review-modal__header">
          <Text variant="subtitle">レビューに追加</Text>
          <button className="add-review-modal__close" onClick={onClose} aria-label="閉じる">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="add-review-modal__search">
          <SearchBox
            value={search}
            onChange={setSearch}
            onSearch={handleSearch}
            placeholder="ノートを検索..."
          />
        </div>

        {error && (
          <div className="add-review-modal__error">
            <Text variant="caption">{error}</Text>
          </div>
        )}

        <div className="add-review-modal__results">
          {loading ? (
            <div className="add-review-modal__loading">
              <Spinner size="md" />
            </div>
          ) : results.length > 0 ? (
            <ul className="add-review-modal__list">
              {results.map((note) => (
                <li key={note.id} className="add-review-modal__item">
                  <div className="add-review-modal__item-content">
                    <Text variant="body">{note.title}</Text>
                    <Text variant="caption">{note.id}</Text>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAdd(note.id)}
                    disabled={addingId === note.id}
                  >
                    {addingId === note.id ? '追加中...' : '追加'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : search.trim() ? (
            <div className="add-review-modal__empty">
              <Text variant="caption">ノートが見つかりませんでした</Text>
            </div>
          ) : (
            <div className="add-review-modal__empty">
              <Text variant="caption">ノート名を検索してください</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
