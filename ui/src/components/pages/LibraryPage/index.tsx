/**
 * LibraryPage - DepthWalk Library メインページ
 * 思考空間を3D図書館として探索する
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LibraryScene, useIsTouchDevice } from './LibraryScene'
import { NotePanel } from './NotePanel'
import { HUD } from './HUD'
import { SearchOverlay } from './SearchOverlay'
import { Minimap } from './Minimap'
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

  // 検索関連の状態
  const [highlightedNoteIds, setHighlightedNoteIds] = useState<string[]>([])
  const [teleportTarget, setTeleportTarget] = useState<[number, number, number] | null>(null)

  // カメラ位置（ミニマップ用）
  const [cameraPosition, setCameraPosition] = useState({ x: 0, z: 30 })

  // Set に変換（パフォーマンス最適化）
  const highlightedNoteIdSet = useMemo(
    () => new Set(highlightedNoteIds),
    [highlightedNoteIds]
  )
  const isSearchActive = highlightedNoteIds.length > 0

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

  // 検索結果からテレポート（noteId付き）
  const handleSearchTeleport = useCallback(
    (position: [number, number, number], noteId: string) => {
      setTeleportTarget(position)
      // テレポート後に該当ノートを選択状態にする
      setSelectedNoteId(noteId)
    },
    []
  )

  // ミニマップからテレポート（noteIdなし）
  const handleMinimapTeleport = useCallback((position: [number, number, number]) => {
    setTeleportTarget(position)
  }, [])

  const handleTeleportComplete = useCallback(() => {
    setTeleportTarget(null)
  }, [])

  // ハイライト対象を更新
  const handleHighlight = useCallback((noteIds: string[]) => {
    setHighlightedNoteIds(noteIds)
  }, [])

  // カメラ位置を更新
  const handleCameraMove = useCallback((position: { x: number; z: number }) => {
    setCameraPosition(position)
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

      <LibraryScene
        clusters={clusters}
        onSelectNote={handleSelectNote}
        highlightedNoteIds={highlightedNoteIdSet}
        isSearchActive={isSearchActive}
        teleportTarget={teleportTarget}
        onTeleportComplete={handleTeleportComplete}
        onCameraMove={handleCameraMove}
      />

      {/* 検索オーバーレイ */}
      <SearchOverlay
        clusters={clusters}
        onTeleport={handleSearchTeleport}
        onHighlight={handleHighlight}
      />

      {/* ミニマップ（タッチデバイスでは非表示） */}
      {!isTouchDevice && (
        <Minimap
          clusters={clusters}
          cameraPosition={cameraPosition}
          onTeleport={handleMinimapTeleport}
        />
      )}

      <HUD noteCount={totalNotes} clusterCount={clusters.length} />

      {/* タッチデバイス用ジョイスティック */}
      {isTouchDevice && <TouchJoystickOverlay />}

      {selectedNoteId && (
        <NotePanel noteId={selectedNoteId} onClose={handleClosePanel} />
      )}
    </div>
  )
}
