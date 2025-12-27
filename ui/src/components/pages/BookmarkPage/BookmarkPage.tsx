import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { BookmarkTree } from '../../organisms/BookmarkTree'
import { AddNoteToBookmarkModal } from '../../organisms/AddNoteToBookmarkModal'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { useBookmarks } from '../../../hooks/useBookmarks'
import type { BookmarkNode } from '../../../types/bookmark'
import './BookmarkPage.css'

export const BookmarkPage = () => {
  const navigate = useNavigate()
  const {
    tree,
    loading,
    error,
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    toggleExpand,
  } = useBookmarks()

  const [isCreating, setIsCreating] = useState(false)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [addNoteModal, setAddNoteModal] = useState<{ folderId: string; folderName: string } | null>(null)

  const handleNodeClick = (node: BookmarkNode) => {
    if (node.type === 'note' && node.noteId) {
      navigate(`/ui/notes/${node.noteId}`)
    }
  }

  const handleCreateFolder = (parentId: string | null) => {
    setCreateParentId(parentId)
    setNewFolderName('')
    setIsCreating(true)
  }

  const handleSubmitFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createNode({
        parentId: createParentId,
        type: 'folder',
        name: newFolderName.trim(),
      })
      setIsCreating(false)
      setNewFolderName('')
    } catch {
      // エラーはuseBookmarksで処理される
    }
  }

  const handleRename = async (id: string, name: string) => {
    try {
      await updateNode(id, { name })
    } catch {
      // エラーはuseBookmarksで処理される
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNode(id)
    } catch {
      // エラーはuseBookmarksで処理される
    }
  }

  const handleToggleExpand = async (id: string, isExpanded: boolean) => {
    await toggleExpand(id, isExpanded)
  }

  const handleAddNote = (folderId: string, folderName: string) => {
    setAddNoteModal({ folderId, folderName })
  }

  const handleAddNoteToFolder = async (noteId: string, noteName: string) => {
    if (!addNoteModal) return
    await createNode({
      parentId: addNoteModal.folderId,
      type: 'note',
      name: noteName,
      noteId: noteId,
    })
  }

  const handleMoveNode = async (id: string, targetParentId: string | null) => {
    try {
      await moveNode(id, targetParentId)
    } catch {
      // エラーはuseBookmarksで処理される
    }
  }

  return (
    <MainLayout>
      <div className="bookmark-page">
        <div className="bookmark-page__header">
          <div className="bookmark-page__title-row">
            <Text variant="title">ブックマーク</Text>
          </div>
          <div className="bookmark-page__actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleCreateFolder(null)}
            >
              フォルダを作成
            </Button>
          </div>
        </div>

        {isCreating && (
          <div className="bookmark-page__create-form">
            <input
              type="text"
              className="bookmark-page__input"
              placeholder="フォルダ名を入力..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitFolder()
                if (e.key === 'Escape') setIsCreating(false)
              }}
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={handleSubmitFolder}>
              作成
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreating(false)}
            >
              キャンセル
            </Button>
          </div>
        )}

        <div className="bookmark-page__content">
          <BookmarkTree
            tree={tree}
            loading={loading}
            error={error}
            onNodeClick={handleNodeClick}
            onToggleExpand={handleToggleExpand}
            onCreateFolder={handleCreateFolder}
            onAddNote={handleAddNote}
            onDelete={handleDelete}
            onRename={handleRename}
            onMoveNode={handleMoveNode}
          />
        </div>
      </div>

      {addNoteModal && (
        <AddNoteToBookmarkModal
          folderName={addNoteModal.folderName}
          onClose={() => setAddNoteModal(null)}
          onAdd={handleAddNoteToFolder}
        />
      )}
    </MainLayout>
  )
}
