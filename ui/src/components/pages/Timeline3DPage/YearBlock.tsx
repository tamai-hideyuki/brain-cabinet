/**
 * YearBlock - 年ブロック（床に配置される3Dオブジェクト）
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

type Props = {
  year: number
  totalNotes: number
  position: [number, number, number]
  isExpanded: boolean
  onToggle: () => void
}

const BLOCK_SIZE: [number, number, number] = [18, 6, 10]
const BASE_COLOR = '#3B82F6'
const EXPANDED_COLOR = '#22C55E'

export function YearBlock({
  year,
  totalNotes,
  position,
  isExpanded,
  onToggle,
}: Props) {
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const pulseRef = useRef(0)

  useFrame((_, delta) => {
    if (hovered || isExpanded) {
      pulseRef.current += delta * 2
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onToggle()
  }

  const color = isExpanded ? EXPANDED_COLOR : BASE_COLOR
  const emissiveIntensity = hovered
    ? 0.6
    : isExpanded
      ? 0.4 + Math.sin(pulseRef.current) * 0.1
      : 0.2

  return (
    <group position={position}>
      {/* メインブロック */}
      <mesh
        ref={meshRef}
        position={[0, BLOCK_SIZE[1] / 2, 0]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={BLOCK_SIZE} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* 年のテキスト */}
      <Text
        position={[0, BLOCK_SIZE[1] / 2, BLOCK_SIZE[2] / 2 + 0.1]}
        fontSize={2.5}
        color={hovered ? '#000000' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {year}
      </Text>

      {/* ノート数 */}
      <Text
        position={[0, BLOCK_SIZE[1] / 2 - 1.5, BLOCK_SIZE[2] / 2 + 0.1]}
        fontSize={0.8}
        color={hovered ? '#333333' : '#88ccff'}
        anchorX="center"
        anchorY="middle"
      >
        {totalNotes}件
      </Text>

      {/* 展開インジケーター */}
      <Text
        position={[0, BLOCK_SIZE[1] + 1, 0]}
        fontSize={1.2}
        color={isExpanded ? EXPANDED_COLOR : '#888888'}
        anchorX="center"
        anchorY="middle"
      >
        {isExpanded ? '▼' : '▶'}
      </Text>

      {/* 床のハイライト */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[BLOCK_SIZE[0] + 4, BLOCK_SIZE[2] + 4]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={hovered ? 0.3 : 0.15}
        />
      </mesh>
    </group>
  )
}
