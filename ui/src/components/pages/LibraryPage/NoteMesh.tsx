/**
 * NoteMesh - ノートを本のように表示する3Dオブジェクト
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { LibraryNote } from '../../../types/library'

type Props = {
  note: LibraryNote
  position: [number, number, number]
  color: string
  onSelect: (noteId: string) => void
}

export function NoteMesh({ note, position, color, onSelect }: Props) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)

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
          color={hovered ? '#ffffff' : color}
          emissive={hovered ? color : '#000000'}
          emissiveIntensity={hovered ? 0.8 : 0.2}
        />
      </mesh>

      {/* タイトル（全文表示・自動改行） */}
      <Text
        position={[0, 0.3, 0.1]}
        fontSize={0.2}
        color={hovered ? '#000000' : '#ffffff'}
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
          color={hovered ? '#333333' : '#aaaaaa'}
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

      {/* ホバー時の枠線エフェクト */}
      {hovered && (
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[3.8, 4.3, 0.1]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.5}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}
