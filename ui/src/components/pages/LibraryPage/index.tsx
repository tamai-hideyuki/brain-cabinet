/**
 * LibraryPage - DepthWalk Library メインページ
 * 思考空間を3D図書館として探索する
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { LibraryScene, useIsTouchDevice } from './LibraryScene'
import { NotePanel } from './NotePanel'
import { HUD } from './HUD'
import { TouchJoystickOverlay } from './TouchJoystickOverlay'
import { fetchLibraryData } from '../../../api/libraryApi'
import type { LibraryCluster } from '../../../types/library'
import './LibraryPage.css'

export function LibraryPage() {
  const [clusters, setClusters] = useState<LibraryCluster[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isTouchDevice = useIsTouchDevice()

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchLibraryData()
        setClusters(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load library data')
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

  const totalNotes = clusters.reduce((sum, c) => sum + c.notes.length, 0)

  if (loading) {
    return (
      <div className="library-loading">
        <div className="library-loading-spinner" />
        <p>Loading Library...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="library-error">
        <p>Error: {error}</p>
        <Link to="/ui" className="library-back-link">
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="library-page">
      <header className="library-header">
        <Link to="/ui" className="library-back">
          ← Back
        </Link>
        <h1>Brain Library</h1>
      </header>

      <LibraryScene clusters={clusters} onSelectNote={handleSelectNote} />

      <HUD noteCount={totalNotes} clusterCount={clusters.length} />

      {/* タッチデバイス用ジョイスティック */}
      {isTouchDevice && <TouchJoystickOverlay />}

      {selectedNoteId && (
        <NotePanel noteId={selectedNoteId} onClose={handleClosePanel} />
      )}
    </div>
  )
}
