import { useRef, useCallback } from 'react'
import { BlockEditable, type BlockEditableRef } from '../../../atoms/BlockEditable'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { TextBlock as TextBlockType } from '../../../../types/block'
import './blocks.css'

type TextBlockProps = {
  block: TextBlockType
}

export const TextBlock = ({ block }: TextBlockProps) => {
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
          return // Don't prevent default, let SlashCommandMenu handle it
        }
      }

      const cursorPos = editableRef.current?.getCursorPosition() ?? 0

      // Enter: Split block or create new
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (cursorPos === block.content.length) {
          // At end: create new block
          actions.insertNewBlock(block.id, 'text')
        } else {
          // In middle: split
          actions.splitBlock(block.id, cursorPos)
        }
        return
      }

      // Backspace at start: Merge with previous
      if (e.key === 'Backspace' && cursorPos === 0 && block.content.length === 0) {
        e.preventDefault()
        actions.deleteBlock(block.id)
        return
      }

      if (e.key === 'Backspace' && cursorPos === 0 && block.content.length > 0) {
        e.preventDefault()
        actions.mergeWithPrev(block.id)
        return
      }

      // Arrow up: Focus previous block
      if (e.key === 'ArrowUp' && cursorPos === 0) {
        e.preventDefault()
        actions.focusPrev(block.id)
        return
      }

      // Arrow down at end: Focus next block
      if (e.key === 'ArrowDown' && cursorPos === block.content.length) {
        e.preventDefault()
        actions.focusNext(block.id)
        return
      }
    },
    [actions, block.id, block.content.length, isSlashMenuOpen]
  )

  const handleFocus = useCallback(() => {
    actions.setFocus(block.id)
  }, [actions, block.id])

  // Register ref
  const setRef = useCallback(
    (element: HTMLElement | null) => {
      registerBlockRef(block.id, element)
    },
    [registerBlockRef, block.id]
  )

  return (
    <div
      className={`block block--text ${isFocused ? 'block--focused' : ''}`}
      ref={setRef}
    >
      <BlockEditable
        ref={editableRef}
        content={block.content}
        marks={block.marks}
        placeholder="テキストを入力..."
        onContentChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      />
    </div>
  )
}
