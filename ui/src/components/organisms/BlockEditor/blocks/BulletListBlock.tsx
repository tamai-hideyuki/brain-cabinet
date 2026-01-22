import { useRef, useCallback } from 'react'
import { BlockEditable, type BlockEditableRef } from '../../../atoms/BlockEditable'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { BulletListBlock as BulletListBlockType } from '../../../../types/block'
import './blocks.css'

type BulletListBlockProps = {
  block: BulletListBlockType
}

export const BulletListBlock = ({ block }: BulletListBlockProps) => {
  const { state, actions, registerBlockRef, isSlashMenuOpen } = useBlockEditorContext()
  const editableRef = useRef<BlockEditableRef>(null)
  const isFocused = state.focusedBlockId === block.id

  const handleContentChange = useCallback(
    (content: string) => {
      actions.updateBlock(block.id, { content })
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

      // Tab: Indent
      if (e.key === 'Tab') {
        e.preventDefault()
        actions.indentBlock(block.id, e.shiftKey ? 'out' : 'in')
        return
      }

      // Enter: Create new list item or exit list
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (block.content.length === 0) {
          // Empty item: convert to text (exit list)
          actions.convertBlock(block.id, 'text')
        } else if (cursorPos === block.content.length) {
          // At end: create new list item
          actions.insertNewBlock(block.id, 'bulletList')
        } else {
          // In middle: split
          actions.splitBlock(block.id, cursorPos)
        }
        return
      }

      // Backspace at start
      if (e.key === 'Backspace' && cursorPos === 0) {
        e.preventDefault()
        if (block.content.length === 0) {
          // Empty: convert to text
          actions.convertBlock(block.id, 'text')
        } else if (block.indent > 0) {
          // Has indent: outdent first
          actions.indentBlock(block.id, 'out')
        } else {
          // No indent: merge with previous
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
      className={`block block--bullet-list ${isFocused ? 'block--focused' : ''}`}
      ref={setRef}
      style={{ paddingLeft: `${block.indent * 1.5}rem` }}
    >
      <span className="block__bullet">•</span>
      <BlockEditable
        ref={editableRef}
        content={block.content}
        marks={block.marks}
        placeholder="リスト項目..."
        onContentChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      />
    </div>
  )
}
