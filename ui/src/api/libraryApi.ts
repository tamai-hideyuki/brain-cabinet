/**
 * Library API クライアント
 * DepthWalk用の軽量データ取得
 */

import { sendCommand } from './commandClient'
import type { LibraryCluster, LibraryNote } from '../types/library'
import type { BookmarkNode } from '../types/bookmark'
import { loadLibraryPositions, getBookmarkPosition } from '../utils/libraryStorage'

type ClusterListItem = {
  id: number
  size: number
  sampleNoteId: string | null
  createdAt: number
  updatedAt: number
}

type ClusterDetailNote = {
  id: string
  title: string
  category: string | null
  tags: string[]
}

type ClusterDetail = {
  id: number
  size: number
  sampleNoteId: string | null
  createdAt: number
  updatedAt: number
  centroid: number[] | null
  notes: ClusterDetailNote[]
}

const CLUSTER_COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#2563EB', // blue
  '#0891B2', // cyan
  '#059669', // emerald
  '#CA8A04', // yellow
  '#EA580C', // orange
  '#DC2626', // red
  '#DB2777', // pink
  '#9333EA', // purple
]

/**
 * ========================================
 * クラスタ・ブックマークの配置設定
 * ========================================
 *
 * 座標系: [x, y, z]
 *   x: 正=右、負=左
 *   y: 正=上、負=下（通常は0で地面に配置）
 *   z: 正=後ろ、負=前
 *
 * 未設定のクラスタはデフォルト位置（円形配置）になります
 */

// クラスタの位置（クラスタIDをキーにして座標を指定）
const CLUSTER_POSITIONS: Record<number, [number, number, number]> = {
  0: [0, 0, 0],       // クラスタ0: 原点
  1: [60, 0, 0],      // クラスタ1: 右
  2: [-60, 0, 0],     // クラスタ2: 左
  3: [0, 0, 60],      // クラスタ3: 後ろ
  4: [0, 0, -60],     // クラスタ4: 前
  5: [60, 0, 60],     // クラスタ5: 右後ろ
  6: [-60, 0, 60],    // クラスタ6: 左後ろ
  7: [60, 0, -60],    // クラスタ7: 右前
  8: [-60, 0, -60],   // クラスタ8: 左前
  9: [120, 0, 0],     // クラスタ9: さらに右
}

// ブックマークフォルダの位置（フォルダ名をキーにして座標を指定）
const BOOKMARK_POSITIONS: Record<string, [number, number, number]> = {
  'ブックマーク': [0, 0, -120],  // ルートブックマーク: 前方
  // 他のフォルダ名があれば追加
  // '仕事': [60, 0, -120],
  // '個人': [-60, 0, -120],
}

/**
 * デフォルトの円形配置（位置が未設定の場合に使用）
 */
function calculateDefaultPosition(index: number, total: number): [number, number, number] {
  if (total === 0) return [0, 0, 0]
  const radius = 80
  const angle = (index / total) * Math.PI * 2
  const x = Math.cos(angle) * radius
  const z = Math.sin(angle) * radius
  return [x, 0, z]
}

/**
 * ブックマークツリーからノートを再帰的に抽出
 */
function extractBookmarkNotes(
  nodes: BookmarkNode[],
  folderName: string | null = null
): { folderName: string; notes: LibraryNote[] }[] {
  const result: { folderName: string; notes: LibraryNote[] }[] = []

  for (const node of nodes) {
    if (node.type === 'folder') {
      // フォルダの場合、子ノードを再帰的に処理
      const folderNotes: LibraryNote[] = []

      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'note' && child.note) {
            folderNotes.push({
              id: child.note.id,
              title: child.note.title,
              clusterId: null,
              category: child.note.category,
              updatedAt: child.updatedAt,
              isBookmarked: true,
            })
          }
        }

        // 子フォルダも再帰的に処理
        const childFolders = extractBookmarkNotes(
          node.children.filter((c) => c.type === 'folder'),
          node.name
        )
        result.push(...childFolders)
      }

      if (folderNotes.length > 0) {
        result.push({ folderName: node.name, notes: folderNotes })
      }
    } else if (node.type === 'note' && node.note && folderName === null) {
      // ルートレベルのノート
      if (!result.find((r) => r.folderName === 'ブックマーク')) {
        result.push({ folderName: 'ブックマーク', notes: [] })
      }
      const rootFolder = result.find((r) => r.folderName === 'ブックマーク')!
      rootFolder.notes.push({
        id: node.note.id,
        title: node.note.title,
        clusterId: null,
        category: node.note.category,
        updatedAt: node.updatedAt,
        isBookmarked: true,
      })
    }
  }

  return result
}

/**
 * ライブラリ用のクラスタ・ノートデータを取得
 */
export async function fetchLibraryData(): Promise<LibraryCluster[]> {
  // クラスタ一覧、ブックマーク、保存済み位置を並列取得
  const [clusters, bookmarks] = await Promise.all([
    sendCommand<ClusterListItem[]>('cluster.list', {}),
    sendCommand<BookmarkNode[]>('bookmark.list', {}),
    loadLibraryPositions(), // キャッシュにロード
  ])

  const libraryClusters: LibraryCluster[] = []
  let positionIndex = 0

  // クラスタデータを構築
  if (clusters && clusters.length > 0) {
    const clusterDetails = await Promise.all(
      clusters.map((c) => sendCommand<ClusterDetail>('cluster.get', { id: c.id }))
    )

    for (const detail of clusterDetails) {
      // 個別指定があればそれを使用、なければデフォルト配置
      const position = CLUSTER_POSITIONS[detail.id] ??
        calculateDefaultPosition(positionIndex, clusterDetails.length)

      libraryClusters.push({
        id: detail.id,
        label: null,
        color: CLUSTER_COLORS[positionIndex % CLUSTER_COLORS.length],
        position,
        notes: detail.notes.map((note) => ({
          id: note.id,
          title: note.title,
          clusterId: detail.id,
          category: note.category,
          updatedAt: 0,
          isBookmarked: false,
        })),
      })
      positionIndex++
    }
  }

  // ブックマークをクラスタとして追加
  if (bookmarks && bookmarks.length > 0) {
    const bookmarkFolders = extractBookmarkNotes(bookmarks)

    for (const folder of bookmarkFolders) {
      if (folder.notes.length > 0) {
        // 優先順位: 1.ユーザー保存位置 2.コード定義 3.デフォルト配置
        const savedPosition = getBookmarkPosition(folder.folderName)
        const position = savedPosition ??
          BOOKMARK_POSITIONS[folder.folderName] ??
          calculateDefaultPosition(positionIndex, libraryClusters.length + bookmarkFolders.length)

        libraryClusters.push({
          id: -1000 - positionIndex, // 負のIDでブックマーククラスタを識別
          label: `📌 ${folder.folderName}`,
          color: '#F59E0B', // amber - ブックマーク用の特別な色
          position,
          notes: folder.notes,
        })
        positionIndex++
      }
    }
  }

  return libraryClusters
}
