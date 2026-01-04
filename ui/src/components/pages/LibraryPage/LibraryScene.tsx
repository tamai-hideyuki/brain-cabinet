/**
 * LibraryScene - 3D図書館空間
 */

import { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BookShelf } from './BookShelf'
import { DraggableBookShelf } from './DraggableBookShelf'
import { PlayerControls } from './PlayerControls'
import { TouchControls } from './TouchControls'
import { saveBookmarkPosition } from '../../../utils/libraryStorage'
import type { LibraryCluster } from '../../../types/library'

/**
 * タッチデバイスかどうかを検出
 */
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE-specific
        navigator.msMaxTouchPoints > 0
      )
    }
    checkTouch()
    window.addEventListener('touchstart', () => setIsTouch(true), { once: true })
  }, [])

  return isTouch
}

type Props = {
  clusters: LibraryCluster[]
  onSelectNote: (noteId: string) => void
  onClusterPositionChange?: (clusterId: number, position: [number, number, number]) => void
  highlightedNoteIds: Set<string>
  isSearchActive: boolean
  teleportTarget: [number, number, number] | null
  onTeleportComplete: () => void
  onCameraMove?: (position: { x: number; z: number }) => void
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#1a1a2e" />
    </mesh>
  )
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 20, 0]} intensity={1} castShadow />
      <pointLight position={[20, 10, 20]} intensity={0.5} color="#4F46E5" />
      <pointLight position={[-20, 10, -20]} intensity={0.5} color="#7C3AED" />
    </>
  )
}

function LoadingIndicator() {
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '1.2rem' }}>Loading...</div>
    </Html>
  )
}

export function LibraryScene({
  clusters,
  onSelectNote,
  onClusterPositionChange,
  highlightedNoteIds,
  isSearchActive,
  teleportTarget,
  onTeleportComplete,
  onCameraMove,
}: Props) {
  const isTouchDevice = useIsTouchDevice()

  // ブックマーククラスタかどうかを判定（負のIDはブックマーク）
  const isBookmarkCluster = (cluster: LibraryCluster) => cluster.id < 0

  const handlePositionChange = (clusterId: number, position: [number, number, number]) => {
    // ブックマークの場合、フォルダ名を取得して保存
    const cluster = clusters.find((c) => c.id === clusterId)
    if (cluster && cluster.label) {
      // "📌 フォルダ名" から フォルダ名を抽出
      const folderName = cluster.label.replace(/^📌\s*/, '')
      saveBookmarkPosition(folderName, position)
    }
    onClusterPositionChange?.(clusterId, position)
  }

  return (
    <Canvas
      camera={{ position: [0, 5, 30], fov: 60 }}
      style={{ background: '#0f0f1a' }}
      shadows
    >
      <Suspense fallback={<LoadingIndicator />}>
        <Lighting />
        <Floor />

        {clusters.map((cluster) =>
          isBookmarkCluster(cluster) ? (
            <DraggableBookShelf
              key={cluster.id}
              cluster={cluster}
              onSelectNote={onSelectNote}
              onPositionChange={handlePositionChange}
              highlightedNoteIds={highlightedNoteIds}
              isSearchActive={isSearchActive}
            />
          ) : (
            <BookShelf
              key={cluster.id}
              cluster={cluster}
              onSelectNote={onSelectNote}
              highlightedNoteIds={highlightedNoteIds}
              isSearchActive={isSearchActive}
            />
          )
        )}

        {/* デバイスに応じたコントロールを表示 */}
        {isTouchDevice ? (
          <TouchControls />
        ) : (
          <PlayerControls
            teleportTarget={teleportTarget}
            onTeleportComplete={onTeleportComplete}
            onCameraMove={onCameraMove}
          />
        )}
      </Suspense>
    </Canvas>
  )
}
