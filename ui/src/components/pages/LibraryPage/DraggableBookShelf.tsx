/**
 * DraggableBookShelf - ドラッグ可能な本棚（ブックマーク用）
 */

import { useRef, useState } from 'react'
import { Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { NoteMesh } from './NoteMesh'
import type { LibraryCluster } from '../../../types/library'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

type Props = {
  cluster: LibraryCluster
  onSelectNote: (noteId: string) => void
  onPositionChange: (clusterId: number, position: [number, number, number]) => void
  onColorChange?: (clusterId: number, folderName: string, screenPosition: { x: number; y: number }) => void
  highlightedNoteIds: Set<string>
  isSearchActive: boolean
}

// 配置設定
const CARDS_PER_ROW = 8
const CARD_WIDTH = 4.0
const CARD_HEIGHT = 5.0
const FLOOR_WIDTH = CARDS_PER_ROW * CARD_WIDTH
const FLOOR_DEPTH = 12

function calculateBookPosition(
  index: number,
  total: number
): [number, number, number] {
  const col = index % CARDS_PER_ROW
  const row = Math.floor(index / CARDS_PER_ROW)
  const rowCount = Math.min(total - row * CARDS_PER_ROW, CARDS_PER_ROW)
  const rowOffset = ((rowCount - 1) * CARD_WIDTH) / 2
  const x = col * CARD_WIDTH - rowOffset
  const y = row * CARD_HEIGHT + 2.5
  const z = 0
  return [x, y, z]
}

function calculateTotalHeight(noteCount: number): number {
  const rows = Math.ceil(noteCount / CARDS_PER_ROW)
  return rows * CARD_HEIGHT + 3
}

export function DraggableBookShelf({
  cluster,
  onSelectNote,
  onPositionChange,
  onColorChange,
  highlightedNoteIds,
  isSearchActive,
}: Props) {
  const totalHeight = calculateTotalHeight(cluster.notes.length)
  const groupRef = useRef<THREE.Group>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const { camera } = useThree()

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setIsDragging(true)
    // マウスキャプチャ
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging && groupRef.current) {
      const newPosition: [number, number, number] = [
        groupRef.current.position.x,
        groupRef.current.position.y,
        groupRef.current.position.z,
      ]
      onPositionChange(cluster.id, newPosition)
    }
    setIsDragging(false)
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !groupRef.current) return
    e.stopPropagation()

    // 床面（y=0）上でのドラッグ
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2(
      (e.nativeEvent.clientX / window.innerWidth) * 2 - 1,
      -(e.nativeEvent.clientY / window.innerHeight) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)

    const intersection = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      groupRef.current.position.x = intersection.x
      groupRef.current.position.z = intersection.z
    }
  }

  // 右クリックで色変更メニューを表示
  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    e.nativeEvent.preventDefault()
    if (onColorChange && cluster.label) {
      // ラベルからフォルダ名を抽出（"📌 フォルダ名" → "フォルダ名"）
      const folderName = cluster.label.replace(/^📌\s*/, '')
      onColorChange(cluster.id, folderName, {
        x: e.nativeEvent.clientX,
        y: e.nativeEvent.clientY,
      })
    }
  }

  return (
    <group
      ref={groupRef}
      position={cluster.position}
      onPointerOver={() => setIsHovered(true)}
      onPointerOut={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
    >
      {/* ドラッグハンドル（クラスタラベルの背景） */}
      <mesh
        position={[0, totalHeight + 1, -2]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <planeGeometry args={[20, 3]} />
        <meshStandardMaterial
          color={isDragging ? '#22C55E' : isHovered ? '#3B82F6' : cluster.color}
          transparent
          opacity={isDragging ? 0.8 : isHovered ? 0.5 : 0.3}
        />
      </mesh>

      {/* ドラッグアイコン */}
      <Text
        position={[-8, totalHeight + 1, -1.9]}
        fontSize={0.8}
        color={isDragging ? '#22C55E' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        ✥
      </Text>

      {/* クラスタラベル */}
      <Text
        position={[0, totalHeight + 1, -1.9]}
        fontSize={1.5}
        color={cluster.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.08}
        outlineColor="#000000"
      >
        {cluster.label || `Cluster ${cluster.id}`}
      </Text>

      {/* ノート数表示 */}
      <Text
        position={[0, totalHeight - 0.5, -2]}
        fontSize={0.5}
        color="#888888"
        anchorX="center"
        anchorY="bottom"
      >
        {cluster.notes.length} notes
      </Text>

      {/* 床のプレート */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshStandardMaterial
          color={cluster.color}
          transparent
          opacity={isDragging ? 0.4 : 0.2}
        />
      </mesh>

      {/* ノート */}
      {cluster.notes.map((note, index) => (
        <NoteMesh
          key={note.id}
          note={note}
          position={calculateBookPosition(index, cluster.notes.length)}
          color={cluster.color}
          onSelect={onSelectNote}
          isHighlighted={highlightedNoteIds.has(note.id)}
          isSearchActive={isSearchActive}
        />
      ))}
    </group>
  )
}
