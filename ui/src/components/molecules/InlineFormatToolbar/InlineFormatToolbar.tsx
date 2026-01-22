import { useEffect, useCallback, useState } from 'react'
import type { MarkType, InlineMark } from '../../../types/block'
import './InlineFormatToolbar.css'

export type SelectionInfo = {
  blockId: string
  start: number
  end: number
  rect: DOMRect
}

type InlineFormatToolbarProps = {
  selection: SelectionInfo | null
  marks: InlineMark[]
  onApplyMark: (type: MarkType, url?: string) => void
  onRemoveMark: (type: MarkType) => void
}

export const InlineFormatToolbar = ({
  selection,
  marks,
  onApplyMark,
  onRemoveMark,
}: InlineFormatToolbarProps) => {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  // Check if selection has a specific mark type
  const hasMarkType = useCallback(
    (type: MarkType): boolean => {
      if (!selection) return false
      return marks.some(
        (mark) =>
          mark.type === type &&
          mark.start < selection.end &&
          mark.end > selection.start
      )
    },
    [selection, marks]
  )

  const handleBold = useCallback(() => {
    if (hasMarkType('bold')) {
      onRemoveMark('bold')
    } else {
      onApplyMark('bold')
    }
  }, [hasMarkType, onApplyMark, onRemoveMark])

  const handleItalic = useCallback(() => {
    if (hasMarkType('italic')) {
      onRemoveMark('italic')
    } else {
      onApplyMark('italic')
    }
  }, [hasMarkType, onApplyMark, onRemoveMark])

  const handleCode = useCallback(() => {
    if (hasMarkType('code')) {
      onRemoveMark('code')
    } else {
      onApplyMark('code')
    }
  }, [hasMarkType, onApplyMark, onRemoveMark])

  const handleLinkClick = useCallback(() => {
    if (hasMarkType('link')) {
      onRemoveMark('link')
    } else {
      setShowLinkInput(true)
    }
  }, [hasMarkType, onRemoveMark])

  const handleLinkSubmit = useCallback(() => {
    if (linkUrl.trim()) {
      onApplyMark('link', linkUrl.trim())
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }, [linkUrl, onApplyMark])

  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleLinkSubmit()
      } else if (e.key === 'Escape') {
        setShowLinkInput(false)
        setLinkUrl('')
      }
    },
    [handleLinkSubmit]
  )

  // Reset link input when selection changes
  useEffect(() => {
    setShowLinkInput(false)
    setLinkUrl('')
  }, [selection?.blockId, selection?.start, selection?.end])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selection) return

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === 'b') {
          e.preventDefault()
          handleBold()
        } else if (e.key === 'i') {
          e.preventDefault()
          handleItalic()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selection, handleBold, handleItalic])

  if (!selection || selection.start === selection.end) {
    return null
  }

  // Prevent mousedown from stealing focus and clearing selection
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  // Calculate toolbar position
  const toolbarStyle: React.CSSProperties = {
    top: selection.rect.top - 40,
    left: selection.rect.left + selection.rect.width / 2,
  }

  return (
    <div className="inline-format-toolbar" style={toolbarStyle} onMouseDown={preventFocusLoss}>
      {showLinkInput ? (
        <div className="inline-format-toolbar__link-input">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="URLを入力..."
            autoFocus
          />
          <button onClick={handleLinkSubmit} disabled={!linkUrl.trim()}>
            適用
          </button>
          <button
            onClick={() => {
              setShowLinkInput(false)
              setLinkUrl('')
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <button
            className={`inline-format-toolbar__button ${
              hasMarkType('bold') ? 'inline-format-toolbar__button--active' : ''
            }`}
            onClick={handleBold}
            title="太字 (⌘B)"
          >
            <strong>B</strong>
          </button>
          <button
            className={`inline-format-toolbar__button ${
              hasMarkType('italic') ? 'inline-format-toolbar__button--active' : ''
            }`}
            onClick={handleItalic}
            title="イタリック (⌘I)"
          >
            <em>I</em>
          </button>
          <button
            className={`inline-format-toolbar__button ${
              hasMarkType('code') ? 'inline-format-toolbar__button--active' : ''
            }`}
            onClick={handleCode}
            title="コード"
          >
            <code>&lt;/&gt;</code>
          </button>
          <button
            className={`inline-format-toolbar__button ${
              hasMarkType('link') ? 'inline-format-toolbar__button--active' : ''
            }`}
            onClick={handleLinkClick}
            title="リンク"
          >
            🔗
          </button>
        </>
      )}
    </div>
  )
}
