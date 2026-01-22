import { useRef, useCallback } from 'react'
import { BlockEditable, type BlockEditableRef } from '../../../atoms/BlockEditable'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { QuoteBlock as QuoteBlockType } from '../../../../types/block'
import './blocks.css'

type QuoteBlockProps = {
  block: QuoteBlockType
}

export const QuoteBlock = ({ block }: QuoteBlockProps) => {
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

      // Enter: Create new text block (exit quote)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (cursorPos === block.content.length) {
          actions.insertNewBlock(block.id, 'text')
        } else {
          actions.splitBlock(block.id, cursorPos)
        }
        return
      }

      // Backspace at start: Convert to text or merge
      if (e.key === 'Backspace' && cursorPos === 0) {
        e.preventDefault()
        if (block.content.length === 0) {
          actions.convertBlock(block.id, 'text')
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
    [actions, block.id, block.content.length, isSlashMenuOpen]
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
      className={`block block--quote ${isFocused ? 'block--focused' : ''}`}
      ref={setRef}
    >
      <BlockEditable
        ref={editableRef}
        content={block.content}
        marks={block.marks}
        placeholder="引用を入力..."
        onContentChange={handleContentChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      />
    </div>
  )
}
