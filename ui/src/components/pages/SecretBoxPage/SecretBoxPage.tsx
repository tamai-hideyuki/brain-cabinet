import { useState, useCallback, useRef, useEffect } from 'react'
import { MainLayout } from '../../templates/MainLayout'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import {
  fetchSecretBoxTree,
  fetchSecretBoxItems,
  uploadSecretBoxItem,
  deleteSecretBoxItem,
  createSecretBoxFolder,
  deleteSecretBoxFolder,
  getSecretBoxItemDataUrl,
  formatFileSize,
} from '../../../api/secretBoxApi'
import type { SecretBoxItem, SecretBoxFolder, SecretBoxTreeNode } from '../../../types/secretBox'
import './SecretBoxPage.css'

export const SecretBoxPage = () => {
  const [folders, setFolders] = useState<SecretBoxTreeNode[]>([])
  const [rootItems, setRootItems] = useState<SecretBoxItem[]>([])
  const [currentFolder, setCurrentFolder] = useState<SecretBoxFolder | null>(null)
  const [currentItems, setCurrentItems] = useState<SecretBoxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<SecretBoxItem | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ツリー読み込み
  const loadTree = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const tree = await fetchSecretBoxTree()
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

  // フォルダ選択時
  const handleSelectFolder = async (folder: SecretBoxFolder | null) => {
    try {
      setCurrentFolder(folder)
      const items = await fetchSecretBoxItems(folder?.id ?? null)
      setCurrentItems(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アイテムの読み込みに失敗しました')
    }
  }

  // ファイルアップロード
  const handleUpload = async (files: FileList) => {
    if (files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (const file of Array.from(files)) {
        await uploadSecretBoxItem(file, undefined, currentFolder?.id ?? null)
      }
      await loadTree()
      await handleSelectFolder(currentFolder)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  // ファイル選択
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files)
    }
  }

  // ドラッグ&ドロップ
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleUpload(e.dataTransfer.files)
    }
  }

  // フォルダ作成
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      await createSecretBoxFolder({
        name: newFolderName.trim(),
        parentId: currentFolder?.id ?? null,
      })
      setNewFolderName('')
      setIsCreatingFolder(false)
      await loadTree()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'フォルダの作成に失敗しました')
    }
  }

  // フォルダ削除
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('このフォルダを削除しますか？')) return

    try {
      await deleteSecretBoxFolder(folderId)
      if (currentFolder?.id === folderId) {
        setCurrentFolder(null)
        setCurrentItems(rootItems)
      }
      await loadTree()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'フォルダの削除に失敗しました')
    }
  }

  // アイテム削除
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('このファイルを削除しますか？')) return

    try {
      await deleteSecretBoxItem(itemId)
      await loadTree()
      await handleSelectFolder(currentFolder)
      if (selectedItem?.id === itemId) {
        setSelectedItem(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルの削除に失敗しました')
    }
  }

  // フォルダツリーレンダリング
  const renderFolderTree = (nodes: SecretBoxTreeNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.id} style={{ paddingLeft: depth * 16 }}>
        <div
          className={`secret-box__folder-item ${currentFolder?.id === node.id ? 'secret-box__folder-item--active' : ''}`}
          onClick={() => handleSelectFolder(node)}
        >
          <span className="secret-box__folder-icon">{node.isExpanded ? '📂' : '📁'}</span>
          <span className="secret-box__folder-name">{node.name}</span>
          <button
            className="secret-box__folder-delete"
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteFolder(node.id)
            }}
          >
            ×
          </button>
        </div>
        {node.children.length > 0 && renderFolderTree(node.children, depth + 1)}
      </div>
    ))
  }

  return (
    <MainLayout>
      <div className="secret-box">
        <div className="secret-box__header">
          <div className="secret-box__title-row">
            <Text variant="title">シークレットBOX</Text>
          </div>
          <div className="secret-box__actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreatingFolder(true)}
            >
              フォルダ作成
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'アップロード中...' : 'ファイルを追加'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {error && (
          <div className="secret-box__error">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {isCreatingFolder && (
          <div className="secret-box__create-form">
            <input
              type="text"
              className="secret-box__input"
              placeholder="フォルダ名を入力..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') setIsCreatingFolder(false)
              }}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={handleCreateFolder}>
              作成
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreatingFolder(false)}
            >
              キャンセル
            </Button>
          </div>
        )}

        <div className="secret-box__main">
          {/* サイドバー: フォルダツリー */}
          <div className="secret-box__sidebar">
            <div className="secret-box__folder-list">
              <div
                className={`secret-box__folder-item ${!currentFolder ? 'secret-box__folder-item--active' : ''}`}
                onClick={() => handleSelectFolder(null)}
              >
                <span className="secret-box__folder-icon">🏠</span>
                <span className="secret-box__folder-name">ルート</span>
              </div>
              {renderFolderTree(folders)}
            </div>
          </div>

          {/* メインエリア: ギャラリー */}
          <div
            className={`secret-box__content ${isDragging ? 'secret-box__content--dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {loading ? (
              <div className="secret-box__loading">読み込み中...</div>
            ) : currentItems.length === 0 ? (
              <div className="secret-box__empty">
                <p>ファイルがありません</p>
                <p>ドラッグ&ドロップまたはボタンでファイルを追加してください</p>
              </div>
            ) : (
              <div className="secret-box__gallery">
                {currentItems.map((item) => (
                  <div
                    key={item.id}
                    className={`secret-box__item ${selectedItem?.id === item.id ? 'secret-box__item--selected' : ''}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="secret-box__item-preview">
                      {item.type === 'image' ? (
                        <img
                          src={getSecretBoxItemDataUrl(item.id)}
                          alt={item.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="secret-box__item-video-icon">🎬</div>
                      )}
                    </div>
                    <div className="secret-box__item-info">
                      <span className="secret-box__item-name" title={item.name}>
                        {item.name}
                      </span>
                      <span className="secret-box__item-size">
                        {formatFileSize(item.size)}
                      </span>
                    </div>
                    <button
                      className="secret-box__item-delete"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteItem(item.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isDragging && (
              <div className="secret-box__drop-overlay">
                ここにドロップしてアップロード
              </div>
            )}
          </div>
        </div>

        {/* ビューアーモーダル */}
        {selectedItem && (
          <div className="secret-box__viewer" onClick={() => setSelectedItem(null)}>
            <div
              className="secret-box__viewer-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="secret-box__viewer-close"
                onClick={() => setSelectedItem(null)}
              >
                ×
              </button>
              {selectedItem.type === 'image' ? (
                <img
                  src={getSecretBoxItemDataUrl(selectedItem.id)}
                  alt={selectedItem.name}
                />
              ) : (
                <video
                  src={getSecretBoxItemDataUrl(selectedItem.id)}
                  controls
                  autoPlay
                />
              )}
              <div className="secret-box__viewer-info">
                <span>{selectedItem.name}</span>
                <span>{formatFileSize(selectedItem.size)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
