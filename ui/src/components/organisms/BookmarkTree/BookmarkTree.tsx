import { useState } from 'react'
import type { BookmarkNode } from '../../../types/bookmark'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import './BookmarkTree.css'

type BookmarkTreeNodeProps = {
  node: BookmarkNode
  depth: number
  onNodeClick: (node: BookmarkNode) => void
  onToggleExpand: (id: string, isExpanded: boolean) => void
  onCreateFolder: (parentId: string | null) => void
  onAddNote: (folderId: string, folderName: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onMoveNode?: (id: string, targetParentId: string | null) => void
  draggedNodeId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
}

const BookmarkTreeNode = ({
  node,
  depth,
  onNodeClick,
  onToggleExpand,
  onCreateFolder,
  onAddNote,
  onDelete,
  onRename,
  onMoveNode,
  draggedNodeId,
  onDragStart,
  onDragEnd,
}: BookmarkTreeNodeProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)
  const [showActions, setShowActions] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const isDragging = draggedNodeId === node.id
  const canDrop = node.type === 'folder' && draggedNodeId !== null && draggedNodeId !== node.id

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', node.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(node.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canDrop) {
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (canDrop && onMoveNode && draggedNodeId) {
      onMoveNode(draggedNodeId, node.id)
    }
  }

  const handleDragEnd = () => {
    onDragEnd()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'folder') {
      onToggleExpand(node.id, !node.isExpanded)
    }
  }

  const handleClick = () => {
    if (node.type === 'note' && node.noteId) {
      onNodeClick(node)
    } else if (node.type === 'link' && node.url) {
      window.open(node.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleRename = () => {
    if (editName.trim() && editName !== node.name) {
      onRename(node.id, editName.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setEditName(node.name)
      setIsEditing(false)
    }
  }

  const getIcon = () => {
    switch (node.type) {
      case 'folder':
        return node.isExpanded ? '📂' : '📁'
      case 'note':
        return '📄'
      case 'link':
        return '🔗'
      default:
        return '📄'
    }
  }

  const getCategoryBadge = () => {
    if (node.type === 'note' && node.note?.category) {
      return (
        <span className="bookmark-tree__category-badge">
          {node.note.category}
        </span>
      )
    }
    return null
  }

  return (
    <div className="bookmark-tree__node">
      <div
        className={`bookmark-tree__item ${node.type === 'folder' ? 'bookmark-tree__item--folder' : ''} ${isDragging ? 'bookmark-tree__item--dragging' : ''} ${isDragOver ? 'bookmark-tree__item--drag-over' : ''}`}
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        onClick={handleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {node.type === 'folder' && (
          <button
            className="bookmark-tree__toggle"
            onClick={handleToggle}
            aria-label={node.isExpanded ? '折りたたむ' : '展開する'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}
        <span className="bookmark-tree__icon">{getIcon()}</span>
        {isEditing ? (
          <input
            type="text"
            className="bookmark-tree__edit-input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="bookmark-tree__name">{node.name}</span>
        )}
        {getCategoryBadge()}
        {showActions && !isEditing && (
          <div className="bookmark-tree__actions">
            {node.type === 'folder' && (
              <>
                <button
                  className="bookmark-tree__action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddNote(node.id, node.name)
                  }}
                  title="メモを追加"
                >
                  📝
                </button>
                <button
                  className="bookmark-tree__action-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateFolder(node.id)
                  }}
                  title="サブフォルダを作成"
                >
                  +
                </button>
              </>
            )}
            <button
              className="bookmark-tree__action-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
              }}
              title="名前を変更"
            >
              ✏️
            </button>
            <button
              className="bookmark-tree__action-btn bookmark-tree__action-btn--danger"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('このブックマークを削除しますか？')) {
                  onDelete(node.id)
                }
              }}
              title="削除"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
      {node.type === 'folder' && node.isExpanded && node.children && (
        <div className="bookmark-tree__children">
          {node.children.map((child) => (
            <BookmarkTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              onCreateFolder={onCreateFolder}
              onAddNote={onAddNote}
              onDelete={onDelete}
              onRename={onRename}
              onMoveNode={onMoveNode}
              draggedNodeId={draggedNodeId}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  )
}

type BookmarkTreeProps = {
  tree: BookmarkNode[]
  loading: boolean
  error: string | null
  onNodeClick: (node: BookmarkNode) => void
  onToggleExpand: (id: string, isExpanded: boolean) => void
  onCreateFolder: (parentId: string | null) => void
  onAddNote: (folderId: string, folderName: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onMoveNode?: (id: string, targetParentId: string | null) => void
}

export const BookmarkTree = ({
  tree,
  loading,
  error,
  onNodeClick,
  onToggleExpand,
  onCreateFolder,
  onAddNote,
  onDelete,
  onRename,
  onMoveNode,
}: BookmarkTreeProps) => {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)

  const handleDragStart = (id: string) => {
    setDraggedNodeId(id)
  }

  const handleDragEnd = () => {
    setDraggedNodeId(null)
  }

  if (loading) {
    return (
      <div className="bookmark-tree__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bookmark-tree__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="bookmark-tree__empty">
        <Text variant="body">ブックマークがありません</Text>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onCreateFolder(null)}
        >
          フォルダを作成
        </Button>
      </div>
    )
  }

  return (
    <div className="bookmark-tree">
      {tree.map((node) => (
        <BookmarkTreeNode
          key={node.id}
          node={node}
          depth={0}
          onNodeClick={onNodeClick}
          onToggleExpand={onToggleExpand}
          onCreateFolder={onCreateFolder}
          onAddNote={onAddNote}
          onDelete={onDelete}
          onRename={onRename}
          onMoveNode={onMoveNode}
          draggedNodeId={draggedNodeId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  )
}
