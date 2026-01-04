/**
 * ライブラリ配置・色のサーバー保存
 */

import { sendCommand } from '../api/commandClient'

// キャッシュ（サーバーから取得した位置・色を保持）
let positionsCache: Record<string, [number, number, number]> | null = null
let colorsCache: Record<string, string> | null = null

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

/**
 * サーバーから全ブックマーク色を取得
 */
export async function loadLibraryColors(): Promise<Record<string, string>> {
  try {
    const colors = await sendCommand<Record<string, string>>(
      'bookmark.getLibraryColors',
      {}
    )
    colorsCache = colors
    return colors
  } catch (e) {
    console.warn('Failed to load library colors:', e)
    return {}
  }
}

/**
 * ブックマーク色をサーバーに保存
 */
export async function saveBookmarkColor(
  folderName: string,
  color: string
): Promise<void> {
  try {
    await sendCommand('bookmark.updateLibraryColor', {
      folderName,
      color,
    })
    // キャッシュも更新
    if (colorsCache) {
      colorsCache[folderName] = color
    }
  } catch (e) {
    console.warn('Failed to save library color:', e)
  }
}

/**
 * キャッシュからブックマーク色を取得（同期）
 */
export function getBookmarkColor(folderName: string): string | null {
  return colorsCache?.[folderName] || null
}
