/**
 * Minimap - ライブラリ空間の俯瞰マップ
 * クラスター位置と現在地を表示、クリックでテレポート
 */

import { useMemo } from 'react'
import type { LibraryCluster } from '../../../types/library'
import './Minimap.css'

type Props = {
  clusters: LibraryCluster[]
  cameraPosition: { x: number; z: number }
  onTeleport: (position: [number, number, number]) => void
}

// マップのスケール設定
const MAP_SIZE = 180 // ピクセル
const WORLD_RANGE = 160 // ワールド座標の範囲 (-160 ~ +160)

/**
 * ワールド座標をマップ座標に変換
 */
function worldToMap(worldX: number, worldZ: number): { x: number; y: number } {
  const scale = MAP_SIZE / (WORLD_RANGE * 2)
  return {
    x: (worldX + WORLD_RANGE) * scale,
    y: (worldZ + WORLD_RANGE) * scale,
  }
}

export function Minimap({ clusters, cameraPosition, onTeleport }: Props) {
  // クラスターのマップ座標を計算
  const clusterMarkers = useMemo(() => {
    return clusters.map((cluster) => {
      const pos = worldToMap(cluster.position[0], cluster.position[2])
      return {
        id: cluster.id,
        label: cluster.label || `Cluster ${cluster.id}`,
        color: cluster.color,
        x: pos.x,
        y: pos.y,
        worldPosition: cluster.position,
        noteCount: cluster.notes.length,
      }
    })
  }, [clusters])

  // 現在位置のマップ座標
  const playerPos = useMemo(() => {
    return worldToMap(cameraPosition.x, cameraPosition.z)
  }, [cameraPosition])

  const handleClusterClick = (worldPosition: [number, number, number]) => {
    onTeleport(worldPosition)
  }

  return (
    <div className="minimap">
      <div className="minimap-container">
        {/* グリッド背景 */}
        <div className="minimap-grid" />

        {/* クラスターマーカー */}
        {clusterMarkers.map((marker) => (
          <button
            key={marker.id}
            className="minimap-cluster"
            style={{
              left: marker.x,
              top: marker.y,
              backgroundColor: marker.color,
            }}
            onClick={() => handleClusterClick(marker.worldPosition)}
            title={`${marker.label} (${marker.noteCount} notes)`}
          >
            <span className="minimap-cluster-count">{marker.noteCount}</span>
          </button>
        ))}

        {/* 現在位置マーカー */}
        <div
          className="minimap-player"
          style={{
            left: playerPos.x,
            top: playerPos.y,
          }}
        />

        {/* 方位表示 */}
        <div className="minimap-compass">N</div>
      </div>

      <div className="minimap-hint">クリックでテレポート</div>
    </div>
  )
}
