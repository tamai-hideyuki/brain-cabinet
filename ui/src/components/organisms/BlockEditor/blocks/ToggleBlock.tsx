import { useRef, useCallback } from 'react'
import { BlockEditable, type BlockEditableRef } from '../../../atoms/BlockEditable'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { ToggleBlock as ToggleBlockType } from '../../../../types/block'
import './blocks.css'

type ToggleBlockProps = {
  block: ToggleBlockType
}

export const ToggleBlock = ({ block }: ToggleBlockProps) => {
  const { state, actions, registerBlockRef, isSlashMenuOpen, onLinkClick } = useBlockEditorContext()
  const editableRef = useRef<BlockEditableRef>(null)
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const isFocused = state.focusedBlockId === block.id

  // Convert children blocks to simple text for display
  const childrenText = block.children
    .map(child => ('content' in child ? (child as any).content : ''))
    .join('\n')

  const handleContentChange = useCallback(
    (content: string) => {
      actions.updateBlock(block.id, { content })
    },
    [actions, block.id]
  )

  const handleToggle = useCallback(() => {
    actions.toggleOpen(block.id)
  }, [actions, block.id])

  // Handle changes to toggle content (the expandable area)
  const handleChildrenTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      // Store as simple text blocks
      const lines = text.split('\n')
      const newChildren = lines.map((line, idx) => ({
        id: `${block.id}-child-${idx}`,
        type: 'text' as const,
        indent: 0,
        content: line,
        marks: [],
      }))
      actions.updateBlock(block.id, { children: newChildren })
    },
    [actions, block.id]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Check if slash menu already handled this event
      if ((e.nativeEvent as any).__slashMenuHandled) {
        return
      }

      // Skip during IME composition (e.g., Japanese input)
      if (e.nativeEvent.isComposing) {
        return
      }

      // When slash menu is open, let it handle arrow keys, Enter, and Escape
      if (isSlashMenuOpen) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
          return
        }
      }

      const cursorPos = editableRef.current?.getCursorPosition() ?? 0

      // Enter: Create new block after toggle
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        actions.insertNewBlock(block.id, 'text')
        return
      }

      // Backspace at start
      if (e.key === 'Backspace' && cursorPos === 0) {
        e.preventDefault()
        if (block.content.length === 0 && block.children.length === 0) {
          actions.convertBlock(block.id, 'text')
        } else if (block.content.length > 0) {
          actions.mergeWithPrev(block.id)
        }
        return
      }

      // Arrow navigation
      if (e.key === 'ArrowUp' && cursorPos === 0) {
        e.preventDefault()
        actions.focusPrev(block.id)
        return
      }

      if (e.key === 'ArrowDown' && cursorPos === block.content.length) {
        e.preventDefault()
        // If toggle is open and has content area, focus that first
        if (block.isOpen && contentTextareaRef.current) {
          contentTextareaRef.current.focus()
          contentTextareaRef.current.setSelectionRange(0, 0)
        } else {
          actions.focusNext(block.id)
        }
        return
      }
    },
    [actions, block.id, block.content.length, block.isOpen, block.children.length, isSlashMenuOpen]
  )

  // Handle keyboard in the content textarea
  const handleContentTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget
      const cursorPos = textarea.selectionStart

      // Arrow up at start: focus toggle header
      if (e.key === 'ArrowUp' && cursorPos === 0) {
        e.preventDefault()
        editableRef.current?.focus()
        return
      }

      // Arrow down at end: focus next block
      if (e.key === 'ArrowDown' && cursorPos === textarea.value.length) {
        e.preventDefault()
        actions.focusNext(block.id)
        return
      }
    },
    [actions, block.id]
  )

  const handleFocus = useCallback(() => {
    actions.setFocus(block.id)
  }, [actions, block.id])

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      registerBlockRef(block.id, element)
    },
    [registerBlockRef, block.id]
  )

  return (
    <div
      className={`block block--toggle ${isFocused ? 'block--focused' : ''} ${block.isOpen ? 'block--toggle-open' : ''}`}
      ref={setRef}
    >
      <div className="block__toggle-header">
        <button
          type="button"
          className="block__toggle-button"
          onClick={handleToggle}
          aria-label={block.isOpen ? '閉じる' : '開く'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={`block__toggle-icon ${block.isOpen ? 'block__toggle-icon--open' : ''}`}
          >
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <BlockEditable
          ref={editableRef}
          content={block.content}
          marks={block.marks}
          placeholder="トグルタイトル..."
          onContentChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onLinkClick={onLinkClick}
        />
      </div>
      {block.isOpen && (
        <div className="block__toggle-content">
          <textarea
            ref={contentTextareaRef}
            className="block__toggle-textarea"
            value={childrenText}
            onChange={handleChildrenTextChange}
            onKeyDown={handleContentTextareaKeyDown}
            placeholder="トグルの内容を入力..."
            rows={Math.max(1, childrenText.split('\n').length)}
          />
        </div>
      )}
    </div>
  )
}
