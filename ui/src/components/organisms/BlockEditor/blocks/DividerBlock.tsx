import { useCallback } from 'react'
import { useBlockEditorContext } from '../BlockEditorContext'
import type { DividerBlock as DividerBlockType } from '../../../../types/block'
import './blocks.css'

type DividerBlockProps = {
  block: DividerBlockType
}

export const DividerBlock = ({ block }: DividerBlockProps) => {
  const { state, actions, registerBlockRef } = useBlockEditorContext()
  const isFocused = state.focusedBlockId === block.id

  const handleClick = useCallback(() => {
    actions.setFocus(block.id)
  }, [actions, block.id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Backspace/Delete: Remove divider
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        actions.deleteBlock(block.id)
        return
      }

      // Enter: Create new block after
      if (e.key === 'Enter') {
        e.preventDefault()
        actions.insertNewBlock(block.id, 'text')
        return
      }

      // Arrow navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        actions.focusPrev(block.id)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        actions.focusNext(block.id)
        return
      }
    },
    [actions, block.id]
  )

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      registerBlockRef(block.id, element)
    },
    [registerBlockRef, block.id]
  )

  return (
    <div
      className={`block block--divider ${isFocused ? 'block--focused' : ''}`}
      ref={setRef}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <hr className="block__divider-line" />
    </div>
  )
}
