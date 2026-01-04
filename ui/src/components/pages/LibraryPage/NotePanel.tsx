/**
 * NotePanel - ノート詳細表示パネル
 */

import { useEffect, useState } from 'react'
import { fetchNote } from '../../../api/notesApi'
import type { Note } from '../../../types/note'
import './NotePanel.css'

type Props = {
  noteId: string
  onClose: () => void
}

export function NotePanel({ noteId, onClose }: Props) {
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchNote(noteId)
        if (!cancelled) {
          setNote(data)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load note')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [noteId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="note-panel-overlay" onClick={onClose}>
      <div className="note-panel" onClick={(e) => e.stopPropagation()}>
        <button className="note-panel-close" onClick={onClose}>
          &times;
        </button>

        {loading && <div className="note-panel-loading">Loading...</div>}

        {error && <div className="note-panel-error">{error}</div>}

        {note && (
          <>
            <h2 className="note-panel-title">{note.title}</h2>
            <div className="note-panel-meta">
              {note.category && <span className="note-panel-category">{note.category}</span>}
              {note.tags.length > 0 && (
                <div className="note-panel-tags">
                  {note.tags.map((tag) => (
                    <span key={tag} className="note-panel-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="note-panel-content">{note.content}</div>
            <div className="note-panel-footer">
              <a href={`/ui/notes/${note.id}`} className="note-panel-link">
                詳細ページを開く →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
