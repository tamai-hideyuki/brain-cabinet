/**
 * TimelineNoteMesh - タイムライン上のノートを3Dカードとして表示
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

export type TimelineNote = {
  id: string
  title: string
  category: string | null
  createdAt: number
  updatedAt: number
}

type Props = {
  note: TimelineNote
  position: [number, number, number]
  color: string
  onSelect: (noteId: string) => void
  isHighlighted?: boolean
  isDimmed?: boolean
}

/**
 * 時刻をフォーマット (HH:MM)
 * updatedAtはUnixタイムスタンプ（秒）
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TimelineNoteMesh({
  note,
  position,
  color,
  onSelect,
  isHighlighted = false,
  isDimmed = false,
}: Props) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const pulseRef = useRef(0)

  // ハイライト時のパルスアニメーション
  useFrame((_, delta) => {
    if (isHighlighted) {
      pulseRef.current += delta * 3
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(note.id)
  }

  // 長すぎるタイトルは省略
  const displayTitle = note.title
    ? note.title.length > 40
      ? note.title.slice(0, 40) + '...'
      : note.title
    : '(無題)'

  const pulseIntensity = isHighlighted ? 0.3 + Math.sin(pulseRef.current) * 0.2 : 0

  // 色の決定
  const cardColor = hovered || isHighlighted ? '#ffffff' : color
  const emissiveColor = hovered || isHighlighted ? color : '#000000'
  const emissiveIntensity = isDimmed
    ? 0.05
    : isHighlighted
      ? 1.0 + pulseIntensity
      : hovered
        ? 0.8
        : 0.2
  const cardOpacity = isDimmed ? 0.3 : 1.0
  const textOpacity = isDimmed ? 0.4 : 1.0

  // 時刻表示
  const timeStr = formatTime(note.updatedAt)

  return (
    <group position={position}>
      {/* 本体（カード形式・少し小さめ） */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[2.5, 3, 0.12]} />
        <meshStandardMaterial
          color={cardColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          transparent={isDimmed}
          opacity={cardOpacity}
        />
      </mesh>

      {/* タイトル */}
      <Text
        position={[0, 0.3, 0.1]}
        fontSize={0.18}
        color={hovered || isHighlighted ? '#000000' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        maxWidth={2.2}
        textAlign="center"
        lineHeight={1.4}
        overflowWrap="break-word"
        fillOpacity={textOpacity}
      >
        {displayTitle}
      </Text>

      {/* 時刻 */}
      <Text
        position={[0, -0.9, 0.1]}
        fontSize={0.16}
        color={hovered || isHighlighted ? '#555555' : '#88ccff'}
        anchorX="center"
        anchorY="middle"
        fillOpacity={textOpacity}
      >
        {timeStr}
      </Text>

      {/* カテゴリ */}
      {note.category && (
        <Text
          position={[0, -1.2, 0.1]}
          fontSize={0.14}
          color={hovered || isHighlighted ? '#333333' : '#aaaaaa'}
          anchorX="center"
          anchorY="middle"
          fillOpacity={textOpacity}
        >
          {note.category}
        </Text>
      )}

      {/* ホバー時の枠線エフェクト */}
      {(hovered || isHighlighted) && (
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[2.7, 3.2, 0.08]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isHighlighted ? 0.8 + pulseIntensity : 0.5}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}
