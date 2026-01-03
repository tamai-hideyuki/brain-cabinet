/**
 * NoteMesh - ノートを本のように表示する3Dオブジェクト
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { LibraryNote } from '../../../types/library'

type Props = {
  note: LibraryNote
  position: [number, number, number]
  color: string
  onSelect: (noteId: string) => void
  isHighlighted?: boolean
  isSearchActive?: boolean
}

export function NoteMesh({
  note,
  position,
  color,
  onSelect,
  isHighlighted = false,
  isSearchActive = false,
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

  // 長すぎるタイトルは省略（maxWidthで自動折り返しされるが念のため）
  const displayTitle = note.title
    ? note.title.length > 80
      ? note.title.slice(0, 80) + '...'
      : note.title
    : '(無題)'

  // 検索中の表示状態を決定
  const dimmed = isSearchActive && !isHighlighted
  const pulseIntensity = isHighlighted ? 0.3 + Math.sin(pulseRef.current) * 0.2 : 0

  // 色の決定
  const cardColor = hovered
    ? '#ffffff'
    : isHighlighted
      ? '#ffffff'
      : dimmed
        ? '#333333'
        : color

  const emissiveColor = hovered || isHighlighted ? color : '#000000'
  const emissiveIntensity = isHighlighted
    ? 1.0 + pulseIntensity
    : hovered
      ? 0.8
      : dimmed
        ? 0
        : 0.2

  return (
    <group position={position}>
      {/* 本体（カード形式・大きめ） */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[3.5, 4, 0.15]} />
        <meshStandardMaterial
          color={cardColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          transparent={dimmed}
          opacity={dimmed ? 0.4 : 1}
        />
      </mesh>

      {/* タイトル（全文表示・自動改行） */}
      <Text
        position={[0, 0.3, 0.1]}
        fontSize={0.2}
        color={hovered || isHighlighted ? '#000000' : dimmed ? '#666666' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        maxWidth={3.0}
        textAlign="center"
        lineHeight={1.4}
        overflowWrap="break-word"
      >
        {displayTitle}
      </Text>

      {/* カテゴリ（常時表示） */}
      {note.category && (
        <Text
          position={[0, -1.5, 0.1]}
          fontSize={0.18}
          color={hovered || isHighlighted ? '#333333' : dimmed ? '#555555' : '#aaaaaa'}
          anchorX="center"
          anchorY="middle"
        >
          {note.category}
        </Text>
      )}

      {/* ブックマークアイコン（右上に表示） */}
      {note.isBookmarked && (
        <Text
          position={[1.4, 1.6, 0.1]}
          fontSize={0.4}
          anchorX="center"
          anchorY="middle"
        >
          📌
        </Text>
      )}

      {/* ホバー時またはハイライト時の枠線エフェクト */}
      {(hovered || isHighlighted) && (
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[3.8, 4.3, 0.1]} />
          <meshStandardMaterial
            color={isHighlighted ? color : '#ffffff'}
            emissive={isHighlighted ? color : '#ffffff'}
            emissiveIntensity={isHighlighted ? 0.8 + pulseIntensity : 0.5}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}
