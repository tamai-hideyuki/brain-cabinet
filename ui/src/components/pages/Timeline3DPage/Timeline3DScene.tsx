/**
 * Timeline3DScene - 3Dタイムライン空間
 */

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Stars } from '@react-three/drei'
import { TimelinePath, type TimelineNote } from './TimelinePath'
import { TimelinePlayerControls } from './TimelinePlayerControls'
import { TouchControls } from '../LibraryPage/TouchControls'
import { useIsTouchDevice } from '../LibraryPage/LibraryScene'

// TimelinePathと同じ定数を使用
const DATE_SPACING = 25

type Props = {
  notes: TimelineNote[]
  onSelectNote: (noteId: string) => void
  highlightedNoteIds: Set<string>
  isSearchActive: boolean
}

/**
 * 動的サイズの床
 * ノートの日付グループ数に応じて床のサイズを調整
 */
function Floor({ dateGroupCount }: { dateGroupCount: number }) {
  // タイムラインの長さに基づいて床のサイズを計算
  const floorDepth = Math.max(500, dateGroupCount * DATE_SPACING + 100) // 最低500、または日付グループ数に応じて拡大
  const floorWidth = 100

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -floorDepth / 2 + 50]} receiveShadow>
      <planeGeometry args={[floorWidth, floorDepth]} />
      <meshStandardMaterial color="#0f1729" />
    </mesh>
  )
}

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 20, 0]} intensity={1} castShadow />
      <pointLight position={[10, 10, 20]} intensity={0.5} color="#3B82F6" />
      <pointLight position={[-10, 10, -20]} intensity={0.5} color="#F59E0B" />
    </>
  )
}

function LoadingIndicator() {
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '1.2rem' }}>Loading Timeline...</div>
    </Html>
  )
}

/**
 * 日付でグループ化してグループ数をカウント
 */
function countDateGroups(notes: TimelineNote[]): number {
  const dates = new Set<string>()
  for (const note of notes) {
    const date = new Date(note.updatedAt * 1000)
    const dateKey = date.toISOString().split('T')[0]
    dates.add(dateKey)
  }
  return dates.size
}

export function Timeline3DScene({
  notes,
  onSelectNote,
  highlightedNoteIds,
  isSearchActive,
}: Props) {
  const isTouchDevice = useIsTouchDevice()
  const dateGroupCount = countDateGroups(notes)

  return (
    <Canvas
      camera={{ position: [0, 5, 30], fov: 60 }}
      style={{ background: '#0a0f1a' }}
      shadows
    >
      <Suspense fallback={<LoadingIndicator />}>
        {/* 星空の背景 */}
        <Stars
          radius={200}
          depth={100}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={0.3}
        />

        <Lighting />
        <Floor dateGroupCount={dateGroupCount} />

        {/* タイムラインの道 */}
        <TimelinePath
          notes={notes}
          onSelectNote={onSelectNote}
          highlightedNoteIds={highlightedNoteIds}
          isSearchActive={isSearchActive}
        />

        {/* コントロール */}
        {isTouchDevice ? (
          <TouchControls />
        ) : (
          <TimelinePlayerControls />
        )}
      </Suspense>
    </Canvas>
  )
}
