/**
 * CalendarNoteMesh - カレンダー上のノートカード
 * TimelineNoteMeshをベースに、浮き上がりアニメーションを追加
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { CalendarNote } from '../../../utils/calendarHierarchy'

type Props = {
  note: CalendarNote
  position: [number, number, number]
  targetPosition: [number, number, number]
  color: string
  onSelect: (noteId: string) => void
  visible: boolean
  index: number
}

const NOTE_COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#059669', // emerald
  '#DC2626', // red
]

export function CalendarNoteMesh({
  note,
  position,
  targetPosition,
  onSelect,
  visible,
  index,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const pulseRef = useRef(0)

  const color = NOTE_COLORS[index % NOTE_COLORS.length]

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // 浮き上がりアニメーション（スタガー付き）
    const delay = index * 0.1
    const elapsed = pulseRef.current

    if (visible && elapsed < delay) {
      pulseRef.current += delta
      return
    }

    const currentPos = groupRef.current.position
    const target = visible
      ? new THREE.Vector3(...targetPosition)
      : new THREE.Vector3(...position)

    currentPos.x = THREE.MathUtils.lerp(currentPos.x, target.x, delta * 8)
    currentPos.y = THREE.MathUtils.lerp(currentPos.y, target.y, delta * 8)
    currentPos.z = THREE.MathUtils.lerp(currentPos.z, target.z, delta * 8)

    // ホバー時のパルス
    if (hovered) {
      pulseRef.current += delta * 3
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(note.id)
  }

  if (!visible && groupRef.current) {
    const dist = groupRef.current.position.distanceTo(
      new THREE.Vector3(...position)
    )
    if (dist < 0.3) return null
  }

  // タイトルを省略
  const displayTitle = note.title
    ? note.title.length > 30
      ? note.title.slice(0, 30) + '...'
      : note.title
    : '(無題)'

  // 時刻
  const time = new Date(note.updatedAt * 1000).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const emissiveIntensity = hovered ? 0.8 : 0.3

  return (
    <group ref={groupRef} position={position}>
      {/* カード本体 */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[4, 2.5, 0.15]} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={visible ? 1 : 0}
        />
      </mesh>

      {/* タイトル */}
      <Text
        position={[0, 0.3, 0.1]}
        fontSize={0.28}
        color={hovered ? '#000000' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        maxWidth={3.5}
        textAlign="center"
        lineHeight={1.3}
        overflowWrap="break-word"
        fillOpacity={visible ? 1 : 0}
      >
        {displayTitle}
      </Text>

      {/* 時刻 */}
      <Text
        position={[0, -0.7, 0.1]}
        fontSize={0.22}
        color={hovered ? '#555555' : '#88ccff'}
        anchorX="center"
        anchorY="middle"
        fillOpacity={visible ? 1 : 0}
      >
        {time}
      </Text>

      {/* カテゴリ */}
      {note.category && (
        <Text
          position={[0, -1, 0.1]}
          fontSize={0.18}
          color={hovered ? '#333333' : '#aaaaaa'}
          anchorX="center"
          anchorY="middle"
          fillOpacity={visible ? 1 : 0}
        >
          {note.category}
        </Text>
      )}

      {/* ホバー時の枠線 */}
      {hovered && (
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[4.2, 2.7, 0.1]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.4}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * ノートの位置を計算（横3列 × 縦積み上げ）
 */
export function calculateNotePosition(
  index: number,
  dayPosition: [number, number, number],
  _totalNotes: number = 1
): [number, number, number] {
  const FLOAT_HEIGHT = 7 // 日付表示より上
  const NOTE_WIDTH = 4.5 // ノートカードの横幅 + 余白
  const NOTE_HEIGHT = 3 // ノートカードの高さ + 余白
  const COLS = 3 // 横3列

  const col = index % COLS // 0, 1, 2
  const row = Math.floor(index / COLS) // 0, 1, 2, ...

  // 中央揃え: col=0 → 左, col=1 → 中央, col=2 → 右
  const offsetX = (col - 1) * NOTE_WIDTH
  const offsetY = row * NOTE_HEIGHT

  return [
    dayPosition[0] + offsetX,
    dayPosition[1] + FLOAT_HEIGHT + offsetY,
    dayPosition[2],
  ]
}

/**
 * ノート数に応じた必要スペースを計算
 */
export function calculateRequiredSpace(noteCount: number): { width: number; height: number } {
  const NOTE_WIDTH = 4.5
  const NOTE_HEIGHT = 3
  const COLS = 3

  const cols = Math.min(noteCount, COLS)
  const rows = Math.ceil(noteCount / COLS)

  return {
    width: cols * NOTE_WIDTH,
    height: rows * NOTE_HEIGHT,
  }
}
