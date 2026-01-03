/**
 * ライブラリ配置のサーバー保存
 */

import { sendCommand } from '../api/commandClient'

// キャッシュ（サーバーから取得した位置を保持）
let positionsCache: Record<string, [number, number, number]> | null = null

/**
 * サーバーから全ブックマーク位置を取得
 */
export async function loadLibraryPositions(): Promise<Record<string, [number, number, number]>> {
  try {
    const positions = await sendCommand<Record<string, [number, number, number]>>(
      'bookmark.getLibraryPositions',
      {}
    )
    positionsCache = positions
    return positions
  } catch (e) {
    console.warn('Failed to load library positions:', e)
    return {}
  }
}

/**
 * ブックマーク位置をサーバーに保存
 */
export async function saveBookmarkPosition(
  folderName: string,
  position: [number, number, number]
): Promise<void> {
  try {
    await sendCommand('bookmark.updateLibraryPosition', {
      folderName,
      position,
    })
    // キャッシュも更新
    if (positionsCache) {
      positionsCache[folderName] = position
    }
  } catch (e) {
    console.warn('Failed to save library position:', e)
  }
}

/**
 * キャッシュからブックマーク位置を取得（同期）
 */
export function getBookmarkPosition(
  folderName: string
): [number, number, number] | null {
  return positionsCache?.[folderName] || null
}
