/**
 * Timeline3DPage - 3Dカレンダー メインページ
 * 年→月→日→ノートの階層的ナビゲーション
 */

import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Calendar3DScene } from './Calendar3DScene'
import { NotePanel } from '../LibraryPage/NotePanel'
import { TouchJoystickOverlay } from '../LibraryPage/TouchJoystickOverlay'
import { useIsTouchDevice } from '../LibraryPage/LibraryScene'
import { useTimelineNotes } from '../../../hooks/useTimelineNotes'
import { useCalendarExpansion } from '../../../hooks/useCalendarExpansion'
import './Timeline3DPage.css'

export function Timeline3DPage() {
  const {
    notes,
    hierarchy,
    loading,
    error,
    selectedNoteId,
    selectNote,
    clearSelection,
  } = useTimelineNotes()

  const isTouchDevice = useIsTouchDevice()
  const [expansionState, expansionActions] = useCalendarExpansion()

  const handleSelectNote = useCallback((noteId: string) => {
    selectNote(noteId)
  }, [selectNote])

  const handleClosePanel = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  // 展開状態のサマリー
  const expansionSummary = useMemo(() => {
    const years = expansionState.expandedYears.size
    const months = expansionState.expandedMonths.size
    const days = expansionState.expandedDays.size
    if (years === 0 && months === 0 && days === 0) return null
    const parts = []
    if (years > 0) parts.push(`${years}年`)
    if (months > 0) parts.push(`${months}月`)
    if (days > 0) parts.push(`${days}日`)
    return parts.join(' / ')
  }, [expansionState])

  if (loading) {
    return (
      <div className="timeline3d-loading">
        <div className="timeline3d-loading-spinner" />
        <p>Loading Calendar...</p>
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
        <h1>Calendar View</h1>
        <span className="timeline3d-note-count">{notes.length} notes</span>
      </header>

      <Calendar3DScene
        hierarchy={hierarchy}
        expansionState={expansionState}
        expansionActions={expansionActions}
        onSelectNote={handleSelectNote}
      />

      {/* 展開状態のサマリーと全閉じボタン */}
      {expansionSummary && (
        <div className="timeline3d-expansion-summary">
          <span>展開中: {expansionSummary}</span>
          <button
            className="timeline3d-collapse-all"
            onClick={expansionActions.collapseAll}
          >
            全て閉じる
          </button>
        </div>
      )}

      {/* タッチデバイス用ジョイスティック */}
      {isTouchDevice && <TouchJoystickOverlay />}

      {/* 操作説明（PCのみ） */}
      {!isTouchDevice && (
        <div className="timeline3d-hud">
          <div className="timeline3d-hud-item">
            <kbd>Click</kbd> year/month/day to expand
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
      )}

      {selectedNoteId && (
        <NotePanel noteId={selectedNoteId} onClose={handleClosePanel} />
      )}
    </div>
  )
}
