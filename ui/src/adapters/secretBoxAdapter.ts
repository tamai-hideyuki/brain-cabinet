/**
 * シークレットBOX Adapter
 * API呼び出しと型変換を担当
 */

import {
  fetchSecretBoxTree,
  fetchSecretBoxItems,
  uploadSecretBoxItem,
  deleteSecretBoxItem,
  createSecretBoxFolder,
  deleteSecretBoxFolder,
  getSecretBoxItemDataUrl,
  getSecretBoxItemThumbnailUrl,
} from '../api/secretBoxApi'
import type {
  SecretBoxItem,
  SecretBoxFolder,
  SecretBoxTreeNode,
  SecretBoxFullTree,
} from '../types/secretBox'

// ドメインモデル（現状はAPI型と同一だが、将来の変換に備えて分離）
export type {
  SecretBoxItem,
  SecretBoxFolder,
  SecretBoxTreeNode,
  SecretBoxFullTree,
}

/**
 * ツリー構造を取得
 */
export const getTree = async (): Promise<SecretBoxFullTree> => {
  return fetchSecretBoxTree()
}

/**
 * フォルダ内のアイテム一覧を取得
 */
export const getItems = async (folderId: string | null): Promise<SecretBoxItem[]> => {
  return fetchSecretBoxItems(folderId)
}

/**
 * ファイルをアップロード
 */
export const uploadFile = async (
  file: File,
  folderId: string | null
): Promise<SecretBoxItem> => {
  return uploadSecretBoxItem(file, undefined, folderId)
}

/**
 * アイテムを削除
 */
export const removeItem = async (itemId: string): Promise<void> => {
  return deleteSecretBoxItem(itemId)
}

/**
 * フォルダを作成
 */
export const addFolder = async (
  name: string,
  parentId: string | null
): Promise<SecretBoxFolder> => {
  return createSecretBoxFolder({ name, parentId })
}

/**
 * フォルダを削除
 */
export const removeFolder = async (folderId: string): Promise<void> => {
  return deleteSecretBoxFolder(folderId)
}

/**
 * アイテムのデータURLを取得
 */
export const getItemDataUrl = (itemId: string): string => {
  return getSecretBoxItemDataUrl(itemId)
}

/**
 * アイテムのサムネイルURLを取得
 */
export const getItemThumbnailUrl = (itemId: string): string => {
  return getSecretBoxItemThumbnailUrl(itemId)
}
