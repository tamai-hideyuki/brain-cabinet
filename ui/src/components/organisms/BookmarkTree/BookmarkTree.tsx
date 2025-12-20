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
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

const BookmarkTreeNode = ({
  node,
  depth,
  onNodeClick,
  onToggleExpand,
  onCreateFolder,
  onDelete,
  onRename,
}: BookmarkTreeNodeProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)
  const [showActions, setShowActions] = useState(false)

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
        className={`bookmark-tree__item ${node.type === 'folder' ? 'bookmark-tree__item--folder' : ''}`}
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        onClick={handleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
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
              onDelete={onDelete}
              onRename={onRename}
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
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

export const BookmarkTree = ({
  tree,
  loading,
  error,
  onNodeClick,
  onToggleExpand,
  onCreateFolder,
  onDelete,
  onRename,
}: BookmarkTreeProps) => {
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
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  )
}
