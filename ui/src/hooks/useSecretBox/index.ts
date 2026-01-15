import { useState, useEffect, useCallback } from 'react'
import * as secretBoxAdapter from '../../adapters/secretBoxAdapter'
import type { SecretBoxItem, SecretBoxFolder, SecretBoxTreeNode } from '../../adapters/secretBoxAdapter'

export const useSecretBox = () => {
  const [folders, setFolders] = useState<SecretBoxTreeNode[]>([])
  const [rootItems, setRootItems] = useState<SecretBoxItem[]>([])
  const [currentFolder, setCurrentFolder] = useState<SecretBoxFolder | null>(null)
  const [currentItems, setCurrentItems] = useState<SecretBoxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadTree = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const tree = await secretBoxAdapter.getTree()
      setFolders(tree.folders)
      setRootItems(tree.rootItems)
      if (!currentFolder) {
        setCurrentItems(tree.rootItems)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [currentFolder])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  const selectFolder = useCallback(async (folder: SecretBoxFolder | null) => {
    try {
      setCurrentFolder(folder)
      const items = await secretBoxAdapter.getItems(folder?.id ?? null)
      setCurrentItems(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アイテムの読み込みに失敗しました')
    }
  }, [])

  const uploadFiles = useCallback(async (files: FileList) => {
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (const file of Array.from(files)) {
        await secretBoxAdapter.uploadFile(file, currentFolder?.id ?? null)
      }
      await loadTree()
      await selectFolder(currentFolder)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }, [currentFolder, loadTree, selectFolder])

  const createFolder = useCallback(async (name: string) => {
    if (!name.trim()) return

    try {
      await secretBoxAdapter.addFolder(name.trim(), currentFolder?.id ?? null)
      await loadTree()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'フォルダの作成に失敗しました')
      throw e
    }
  }, [currentFolder, loadTree])

  const removeFolder = useCallback(async (folderId: string) => {
    try {
      await secretBoxAdapter.removeFolder(folderId)
      if (currentFolder?.id === folderId) {
        setCurrentFolder(null)
        setCurrentItems(rootItems)
      }
      await loadTree()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'フォルダの削除に失敗しました')
      throw e
    }
  }, [currentFolder, rootItems, loadTree])

  const removeItem = useCallback(async (itemId: string) => {
    try {
      await secretBoxAdapter.removeItem(itemId)
      await loadTree()
      await selectFolder(currentFolder)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルの削除に失敗しました')
      throw e
    }
  }, [currentFolder, loadTree, selectFolder])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    folders,
    rootItems,
    currentFolder,
    currentItems,
    loading,
    error,
    uploading,
    reload: loadTree,
    selectFolder,
    uploadFiles,
    createFolder,
    removeFolder,
    removeItem,
    clearError,
  }
}
