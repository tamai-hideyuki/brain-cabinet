/**
 * MonthBlock - 月ブロック（年の上に3x4グリッドで浮遊）
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Mesh } from 'three'
import type { ThreeEvent } from '@react-three/fiber'

type Props = {
  month: number
  monthKey: string
  label: string
  totalNotes: number
  position: [number, number, number]
  targetPosition: [number, number, number]
  isExpanded: boolean
  onToggle: () => void
  visible: boolean
}

const BLOCK_SIZE: [number, number, number] = [5, 3, 3]
const BASE_COLOR = '#7C3AED'
const EXPANDED_COLOR = '#F59E0B'

export function MonthBlock({
  month,
  label,
  totalNotes,
  position,
  targetPosition,
  isExpanded,
  onToggle,
  visible,
}: Props) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const pulseRef = useRef(0)

  // 浮き上がりアニメーション
  useFrame((_, delta) => {
    if (!groupRef.current) return

    // 現在位置からターゲット位置へ補間
    const currentPos = groupRef.current.position
    const target = visible
      ? new THREE.Vector3(...targetPosition)
      : new THREE.Vector3(...position)

    currentPos.x = THREE.MathUtils.lerp(currentPos.x, target.x, delta * 5)
    currentPos.y = THREE.MathUtils.lerp(currentPos.y, target.y, delta * 5)
    currentPos.z = THREE.MathUtils.lerp(currentPos.z, target.z, delta * 5)

    // パルスアニメーション
    if (hovered || isExpanded) {
      pulseRef.current += delta * 2
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onToggle()
  }

  if (!visible && groupRef.current) {
    // 非表示時は初期位置付近ならレンダリングしない
    const dist = groupRef.current.position.distanceTo(
      new THREE.Vector3(...position)
    )
    if (dist < 0.5) return null
  }

  const color = isExpanded ? EXPANDED_COLOR : BASE_COLOR
  const emissiveIntensity = hovered
    ? 0.7
    : isExpanded
      ? 0.5 + Math.sin(pulseRef.current) * 0.15
      : 0.3

  // 月に応じた色相を少し変える
  const hueShift = (month - 1) * 10
  const adjustedColor = new THREE.Color(color).offsetHSL(hueShift / 360, 0, 0)

  return (
    <group ref={groupRef} position={position}>
      {/* メインブロック */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={BLOCK_SIZE} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : adjustedColor}
          emissive={adjustedColor}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={visible ? 1 : 0}
        />
      </mesh>

      {/* 月のラベル（上部に表示） */}
      <Text
        position={[0, BLOCK_SIZE[1] / 2 + 0.8, 0]}
        fontSize={1}
        color={hovered ? '#ffffff' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        fillOpacity={visible ? 1 : 0}
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {label}
      </Text>

      {/* ノート数（ブロック上面） */}
      {totalNotes > 0 && (
        <Text
          position={[0, BLOCK_SIZE[1] / 2 + 0.1, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.8}
          color={hovered ? '#000000' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          fillOpacity={visible ? 1 : 0}
        >
          {totalNotes}
        </Text>
      )}

      {/* 展開インジケーター（ノートがある場合のみ） */}
      {totalNotes > 0 && (
        <Text
          position={[0, BLOCK_SIZE[1] / 2 + 2, 0]}
          fontSize={0.6}
          color={isExpanded ? EXPANDED_COLOR : '#888888'}
          anchorX="center"
          anchorY="middle"
          fillOpacity={visible ? 1 : 0}
        >
          {isExpanded ? '▼' : '▶'}
        </Text>
      )}
    </group>
  )
}

/**
 * 3x4グリッドでの月の位置を計算
 * expandedMonths: 展開されている月のセット（この年の月キー）
 * thisMonthKey: この月のキー
 * expandedDays: 展開されている日のセット（メモ展開時の連動用）
 */
export function calculateMonthPosition(
  month: number,
  yearPosition: [number, number, number],
  expandedMonths: Set<string>,
  thisMonthKey: string,
  expandedDays?: Set<string>
): [number, number, number] {
  const GRID_COLS = 3
  const GRID_GAP_X_NORMAL = 6
  const GRID_GAP_Z_NORMAL = 4
  const GRID_GAP_X_MONTH_EXPANDED = 25 // 月展開時（日グリッド通常間隔）
  const GRID_GAP_Z_MONTH_EXPANDED = 20
  const GRID_GAP_X_DAY_EXPANDED = 110 // 日展開時（メモ3列分の日グリッド）
  const GRID_GAP_Z_DAY_EXPANDED = 80
  const FLOAT_HEIGHT = 15
  const EXPANDED_LIFT = 30 // 展開時に上に持ち上げる

  const col = (month - 1) % GRID_COLS
  const row = Math.floor((month - 1) / GRID_COLS)

  const isThisMonthExpanded = expandedMonths.has(thisMonthKey)
  const yearStr = thisMonthKey.split('-')[0]

  // 展開されている月があれば、その行/列は広い間隔を使う
  let hasExpandedMonthInSameRow = false
  let hasExpandedMonthInSameCol = false
  // さらに、展開されている月内で日が展開されているかチェック
  let hasExpandedDayInSameRow = false
  let hasExpandedDayInSameCol = false

  for (const expandedKey of expandedMonths) {
    // この年の月のみチェック
    if (!expandedKey.startsWith(`${yearStr}-`)) continue

    const expandedMonth = parseInt(expandedKey.split('-')[1], 10)
    const expandedCol = (expandedMonth - 1) % GRID_COLS
    const expandedRow = Math.floor((expandedMonth - 1) / GRID_COLS)

    if (expandedRow === row) hasExpandedMonthInSameRow = true
    if (expandedCol === col) hasExpandedMonthInSameCol = true

    // この展開月内で日が展開されているかチェック
    if (expandedDays) {
      for (const dayKey of expandedDays) {
        if (dayKey.startsWith(expandedKey + '-')) {
          if (expandedRow === row) hasExpandedDayInSameRow = true
          if (expandedCol === col) hasExpandedDayInSameCol = true
        }
      }
    }
  }

  // 間隔を決定（日展開 > 月展開 > 通常）
  let gapX = GRID_GAP_X_NORMAL
  let gapZ = GRID_GAP_Z_NORMAL

  if (hasExpandedDayInSameRow) {
    gapX = GRID_GAP_X_DAY_EXPANDED
  } else if (hasExpandedMonthInSameRow) {
    gapX = GRID_GAP_X_MONTH_EXPANDED
  }

  if (hasExpandedDayInSameCol) {
    gapZ = GRID_GAP_Z_DAY_EXPANDED
  } else if (hasExpandedMonthInSameCol) {
    gapZ = GRID_GAP_Z_MONTH_EXPANDED
  }

  // グリッドの中心を年ブロックの上に配置
  const offsetX = (col - 1) * gapX
  const offsetZ = (row - 1.5) * gapZ

  // 展開時は上に持ち上げて日グリッドのスペースを確保
  const height = isThisMonthExpanded ? FLOAT_HEIGHT + EXPANDED_LIFT : FLOAT_HEIGHT

  return [
    yearPosition[0] + offsetX,
    yearPosition[1] + height,
    yearPosition[2] + offsetZ,
  ]
}
