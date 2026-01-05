/**
 * Timeline3DPage - 3Dタイムライン メインページ
 * 時間軸に沿った道の上でメモを探索する
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Timeline3DScene } from './Timeline3DScene'
import { TimelineSearchOverlay } from './TimelineSearchOverlay'
import { NotePanel } from '../LibraryPage/NotePanel'
import { fetchNotes } from '../../../api/notesApi'
import type { TimelineNote } from './TimelinePath'
import './Timeline3DPage.css'

export function Timeline3DPage() {
  const [notes, setNotes] = useState<TimelineNote[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [highlightedNoteIds, setHighlightedNoteIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Set に変換（パフォーマンス最適化）
  const highlightedNoteIdSet = useMemo(
    () => new Set(highlightedNoteIds),
    [highlightedNoteIds]
  )
  const isSearchActive = highlightedNoteIds.length > 0

  useEffect(() => {
    async function load() {
      try {
        // 全ノートを取得（limit: 0 で全件）
        const result = await fetchNotes({ limit: 0 })
        // TimelineNote形式に変換
        const timelineNotes: TimelineNote[] = result.notes.map((n) => ({
          id: n.id,
          title: n.title,
          category: n.category,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }))
        setNotes(timelineNotes)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load notes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedNoteId(null)
  }, [])

  const handleHighlight = useCallback((noteIds: string[]) => {
    setHighlightedNoteIds(noteIds)
  }, [])

  if (loading) {
    return (
      <div className="timeline3d-loading">
        <div className="timeline3d-loading-spinner" />
        <p>Loading Timeline...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="timeline3d-error">
        <p>Error: {error}</p>
        <Link to="/ui" className="timeline3d-back-link">
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="timeline3d-page">
      <header className="timeline3d-header">
        <Link to="/ui" className="timeline3d-back">
          ← Back
        </Link>
        <h1>Timeline Walk</h1>
        <span className="timeline3d-note-count">{notes.length} notes</span>
      </header>

      <Timeline3DScene
        notes={notes}
        onSelectNote={handleSelectNote}
        highlightedNoteIds={highlightedNoteIdSet}
        isSearchActive={isSearchActive}
      />

      {/* 検索オーバーレイ */}
      <TimelineSearchOverlay
        notes={notes}
        onHighlight={handleHighlight}
        onSelectNote={handleSelectNote}
      />

      {/* 操作説明 */}
      <div className="timeline3d-hud">
        <div className="timeline3d-hud-item">
          <kbd>Click</kbd> to lock mouse
        </div>
        <div className="timeline3d-hud-item">
          <kbd>WASD</kbd> / <kbd>Arrow</kbd> to move
        </div>
        <div className="timeline3d-hud-item">
          <kbd>Q</kbd>/<kbd>E</kbd> to up/down
        </div>
        <div className="timeline3d-hud-item">
          <kbd>Shift</kbd> to sprint
        </div>
      </div>

      {selectedNoteId && (
        <NotePanel noteId={selectedNoteId} onClose={handleClosePanel} />
      )}
    </div>
  )
}
