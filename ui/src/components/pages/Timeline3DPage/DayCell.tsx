/**
 * DayCell - 日セル（カレンダーグリッドの1日分）
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'

type Props = {
  day: number
  dateKey: string
  noteCount: number
  position: [number, number, number]
  targetPosition: [number, number, number]
  isExpanded: boolean
  onToggle: () => void
  visible: boolean
  isToday?: boolean
}

const CELL_SIZE = 2.5
const BASE_COLOR = '#0891B2'
const EXPANDED_COLOR = '#F59E0B'
const TODAY_COLOR = '#DC2626'
const EMPTY_COLOR = '#374151'

export function DayCell({
  day,
  noteCount,
  position,
  targetPosition,
  isExpanded,
  onToggle,
  visible,
  isToday = false,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const pulseRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // 浮き上がりアニメーション
    const currentPos = groupRef.current.position
    const target = visible
      ? new THREE.Vector3(...targetPosition)
      : new THREE.Vector3(...position)

    currentPos.x = THREE.MathUtils.lerp(currentPos.x, target.x, delta * 6)
    currentPos.y = THREE.MathUtils.lerp(currentPos.y, target.y, delta * 6)
    currentPos.z = THREE.MathUtils.lerp(currentPos.z, target.z, delta * 6)

    // パルス
    if ((hovered || isExpanded) && noteCount > 0) {
      pulseRef.current += delta * 3
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (noteCount > 0) {
      onToggle()
    }
  }

  if (!visible && groupRef.current) {
    const dist = groupRef.current.position.distanceTo(
      new THREE.Vector3(...position)
    )
    if (dist < 0.3) return null
  }

  // 色の決定
  let color = noteCount > 0 ? BASE_COLOR : EMPTY_COLOR
  if (isToday) color = TODAY_COLOR
  if (isExpanded) color = EXPANDED_COLOR

  const hasNotes = noteCount > 0
  const emissiveIntensity = hasNotes
    ? hovered
      ? 0.8
      : isExpanded
        ? 0.6 + Math.sin(pulseRef.current) * 0.1
        : 0.3
    : 0.05

  return (
    <group ref={groupRef} position={position}>
      {/* セル本体 */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[CELL_SIZE, 0.5, CELL_SIZE]} />
        <meshStandardMaterial
          color={hovered && hasNotes ? '#ffffff' : color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={visible ? 1 : 0}
        />
      </mesh>

      {/* 日付（ブロックの上に浮かせて表示、ノート展開時に被らない高さ） */}
      <Text
        position={[0, 5, 0]}
        fontSize={1.2}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight={hasNotes ? 'bold' : 'normal'}
        fillOpacity={visible ? 1 : 0}
        outlineWidth={0.06}
        outlineColor="#000000"
      >
        {day}
      </Text>


      {/* 今日のマーカー */}
      {isToday && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
          <ringGeometry args={[CELL_SIZE / 2 - 0.1, CELL_SIZE / 2, 32]} />
          <meshStandardMaterial
            color={TODAY_COLOR}
            emissive={TODAY_COLOR}
            emissiveIntensity={0.8}
            transparent
            opacity={visible ? 0.8 : 0}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * カレンダーグリッドでの日の位置を計算（7列 x 5-6行）
 * expandedDays: 展開されている日のセット
 * thisDayKey: この日のキー
 * year, month: 年月（展開日の行/列判定用）
 * firstDayOfWeek: 月初の曜日
 */
export function calculateDayPosition(
  day: number,
  firstDayOfWeek: number,
  monthPosition: [number, number, number],
  expandedDays?: Set<string>,
  year?: number,
  month?: number
): [number, number, number] {
  const GRID_GAP_NORMAL = 3 // 通常時の間隔
  const GRID_GAP_EXPANDED = 15 // 展開時の間隔（メモ3列分）
  const FLOAT_HEIGHT = 10

  // 曜日オフセットを考慮した位置
  const dayIndex = day - 1 + firstDayOfWeek
  const col = dayIndex % 7
  const row = Math.floor(dayIndex / 7)

  // 展開されている日があるかチェック
  let hasExpandedInSameRow = false
  let hasExpandedInSameCol = false

  if (expandedDays && year && month) {
    for (const expandedKey of expandedDays) {
      // この月の展開日のみチェック
      const prefix = `${year}-${String(month).padStart(2, '0')}-`
      if (!expandedKey.startsWith(prefix)) continue

      const expandedDay = parseInt(expandedKey.split('-')[2], 10)
      const expandedDayIndex = expandedDay - 1 + firstDayOfWeek
      const expandedCol = expandedDayIndex % 7
      const expandedRow = Math.floor(expandedDayIndex / 7)

      if (expandedRow === row) hasExpandedInSameRow = true
      if (expandedCol === col) hasExpandedInSameCol = true
    }
  }

  // 間隔を決定
  const gapX = hasExpandedInSameRow ? GRID_GAP_EXPANDED : GRID_GAP_NORMAL
  const gapZ = hasExpandedInSameCol ? GRID_GAP_EXPANDED : GRID_GAP_NORMAL

  // グリッドの中心を月ブロックの上に配置
  const offsetX = (col - 3) * gapX
  const offsetZ = (row - 2) * gapZ

  return [
    monthPosition[0] + offsetX,
    monthPosition[1] + FLOAT_HEIGHT,
    monthPosition[2] + offsetZ,
  ]
}

/**
 * 今日かどうかを判定
 */
export function isToday(dateKey: string): boolean {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dateKey === todayKey
}
