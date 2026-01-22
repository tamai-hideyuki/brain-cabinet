import { useRef, useCallback } from 'react'
import { BlockEditable, type BlockEditableRef } from '../../../atoms/BlockEditable'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { ChecklistBlock as ChecklistBlockType } from '../../../../types/block'
import './blocks.css'

type ChecklistBlockProps = {
  block: ChecklistBlockType
}

export const ChecklistBlock = ({ block }: ChecklistBlockProps) => {
  const { state, actions, registerBlockRef, isSlashMenuOpen, onLinkClick } = useBlockEditorContext()
  const editableRef = useRef<BlockEditableRef>(null)
  const isFocused = state.focusedBlockId === block.id

  const handleContentChange = useCallback(
    (content: string) => {
      actions.updateBlock(block.id, { content })
    },
    [actions, block.id]
  )

  const handleCheckboxClick = useCallback(() => {
    actions.toggleChecked(block.id)
  }, [actions, block.id])

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

      // Tab: Indent
      if (e.key === 'Tab') {
        e.preventDefault()
        actions.indentBlock(block.id, e.shiftKey ? 'out' : 'in')
        return
      }

      // Enter: Create new checklist item or exit
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (block.content.length === 0) {
          actions.convertBlock(block.id, 'text')
        } else if (cursorPos === block.content.length) {
          actions.insertNewBlock(block.id, 'checklist')
        } else {
          actions.splitBlock(block.id, cursorPos)
        }
        return
      }

      // Backspace at start
      if (e.key === 'Backspace' && cursorPos === 0) {
        e.preventDefault()
        if (block.content.length === 0) {
          actions.convertBlock(block.id, 'text')
        } else if (block.indent > 0) {
          actions.indentBlock(block.id, 'out')
        } else {
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
        actions.focusNext(block.id)
        return
      }
    },
    [actions, block.id, block.content.length, block.indent, isSlashMenuOpen]
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
      className={`block block--checklist ${isFocused ? 'block--focused' : ''} ${block.checked ? 'block--checked' : ''}`}
      ref={setRef}
      style={{ paddingLeft: `${block.indent * 1.5}rem` }}
    >
      <button
        type="button"
        className="block__checkbox"
        onClick={handleCheckboxClick}
        aria-label={block.checked ? 'チェックを外す' : 'チェックする'}
      >
        {block.checked ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--color-primary)" />
            <path d="M4 8L7 11L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="var(--color-border-hover)" strokeWidth="1" />
          </svg>
        )}
      </button>
      <BlockEditable
        ref={editableRef}
        content={block.content}
        marks={block.marks}
        placeholder="タスク..."
        className={block.checked ? 'block__content--checked' : ''}
        onContentChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onLinkClick={onLinkClick}
      />
    </div>
  )
}
