/**
 * BookShelf - クラスタを本棚として表示
 */

import { Text } from '@react-three/drei'
import { NoteMesh } from './NoteMesh'
import type { LibraryCluster } from '../../../types/library'

type Props = {
  cluster: LibraryCluster
  onSelectNote: (noteId: string) => void
}

// 配置設定
const CARDS_PER_ROW = 8 // 1行あたり8枚
const CARD_WIDTH = 4.0 // カード幅 + 余白
const CARD_HEIGHT = 5.0 // カード高さ + 余白
const FLOOR_WIDTH = CARDS_PER_ROW * CARD_WIDTH // 床幅は8枚分
const FLOOR_DEPTH = 12

/**
 * ノートをグリッド配置
 * 床の面積内に収まるように横に並べ、超えたら上の段へ
 */
function calculateBookPosition(
  index: number,
  total: number
): [number, number, number] {
  const col = index % CARDS_PER_ROW
  const row = Math.floor(index / CARDS_PER_ROW)

  // 横方向は中央揃え
  const rowCount = Math.min(total - row * CARDS_PER_ROW, CARDS_PER_ROW)
  const rowOffset = ((rowCount - 1) * CARD_WIDTH) / 2

  const x = col * CARD_WIDTH - rowOffset
  const y = row * CARD_HEIGHT + 2.5 // 最初の段は高さ2.5から
  const z = 0

  return [x, y, z]
}

/**
 * 必要な高さを計算（クラスタラベルの位置決めに使用）
 */
function calculateTotalHeight(noteCount: number): number {
  const rows = Math.ceil(noteCount / CARDS_PER_ROW)
  return rows * CARD_HEIGHT + 3
}

export function BookShelf({ cluster, onSelectNote }: Props) {
  const totalHeight = calculateTotalHeight(cluster.notes.length)

  return (
    <group position={cluster.position}>
      {/* クラスタラベル（大きく表示・一番上） */}
      <Text
        position={[0, totalHeight + 1, -2]}
        fontSize={1.5}
        color={cluster.color}
        anchorX="center"
        anchorY="bottom"
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

      {/* 床のプレート（クラスタ範囲を示す） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshStandardMaterial
          color={cluster.color}
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* ノート（グリッド配置） */}
      {cluster.notes.map((note, index) => (
        <NoteMesh
          key={note.id}
          note={note}
          position={calculateBookPosition(index, cluster.notes.length)}
          color={cluster.color}
          onSelect={onSelectNote}
        />
      ))}
    </group>
  )
}
