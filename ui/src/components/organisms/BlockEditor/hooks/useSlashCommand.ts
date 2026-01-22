import { useState, useCallback, useEffect } from 'react'
import type { Block, BlockType } from '../../../../types/block'

type UseSlashCommandOptions = {
  blocks: Block[]
  focusedBlockId: string | null
  getBlockRef: (id: string) => HTMLElement | null
  onInsertBlock: (type: BlockType) => void
  onUpdateBlock: (id: string, updates: Partial<Block>) => void
  onConvertBlock: (id: string, toType: BlockType) => void
  onSetFocus: (blockId: string | null, cursorPosition?: number) => void
}

export function useSlashCommand({
  blocks,
  focusedBlockId,
  getBlockRef,
  onInsertBlock,
  onUpdateBlock,
  onConvertBlock,
  onSetFocus,
}: UseSlashCommandOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [searchText, setSearchText] = useState('')
  const [slashPosition, setSlashPosition] = useState<number | null>(null)

  // Check for slash command trigger
  const checkForSlashCommand = useCallback(() => {
    if (!focusedBlockId) {
      setIsOpen(false)
      return
    }

    const block = blocks.find(b => b.id === focusedBlockId)
    if (!block || !('content' in block)) {
      setIsOpen(false)
      return
    }

    const content = (block as any).content as string
    const element = getBlockRef(focusedBlockId)
    if (!element) {
      setIsOpen(false)
      return
    }

    // Get cursor position
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setIsOpen(false)
      return
    }

    const range = selection.getRangeAt(0)

    // Find editable element
    let editableElement = range.startContainer
    while (editableElement && !(editableElement as HTMLElement).contentEditable) {
      editableElement = editableElement.parentNode as Node
    }

    if (!editableElement) {
      setIsOpen(false)
      return
    }

    // Get cursor position in text
    const preRange = range.cloneRange()
    preRange.selectNodeContents(editableElement)
    preRange.setEnd(range.startContainer, range.startOffset)
    const cursorPos = preRange.toString().length

    // Check for slash at start of line or after whitespace
    const textBefore = content.slice(0, cursorPos)
    const slashMatch = textBefore.match(/(?:^|\s)\/(\w*)$/)

    if (slashMatch) {
      const matchStart = textBefore.lastIndexOf('/')
      setSlashPosition(matchStart)
      setSearchText(slashMatch[1])

      // Calculate menu position
      const rect = range.getBoundingClientRect()
      setPosition({
        x: rect.left,
        y: rect.bottom + 4,
      })

      setIsOpen(true)
    } else {
      setIsOpen(false)
      setSlashPosition(null)
    }
  }, [blocks, focusedBlockId, getBlockRef])

  // Listen for input events
  useEffect(() => {
    const handleInput = () => {
      // Small delay to let content update
      requestAnimationFrame(checkForSlashCommand)
    }

    const handleSelectionChange = () => {
      if (isOpen) {
        checkForSlashCommand()
      }
    }

    document.addEventListener('input', handleInput)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('input', handleInput)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [checkForSlashCommand, isOpen])

  // Handle command selection
  const handleSelect = useCallback(
    (type: BlockType) => {
      if (!focusedBlockId || slashPosition === null) return

      const block = blocks.find(b => b.id === focusedBlockId)
      if (!block || !('content' in block)) return

      const content = (block as any).content as string

      // Remove the slash command text
      const beforeSlash = content.slice(0, slashPosition)
      const afterCommand = content.slice(slashPosition + 1 + searchText.length)
      const newContent = beforeSlash + afterCommand

      // First, update the content to remove the slash command
      // Then convert the block type
      if (newContent.trim() === '') {
        // Update content first, then convert
        onUpdateBlock(focusedBlockId, { content: '' } as any)
        // Use setTimeout to ensure the update is processed before conversion
        setTimeout(() => {
          onConvertBlock(focusedBlockId, type)
          // Re-focus the same block after conversion
          setTimeout(() => {
            onSetFocus(focusedBlockId, 0)
          }, 0)
        }, 0)
      } else {
        // Update current block and insert new one
        onUpdateBlock(focusedBlockId, { content: newContent } as any)
        onInsertBlock(type)
      }

      setIsOpen(false)
      setSlashPosition(null)
      setSearchText('')
    },
    [focusedBlockId, blocks, slashPosition, searchText, onUpdateBlock, onInsertBlock, onConvertBlock, onSetFocus]
  )

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSlashPosition(null)
    setSearchText('')
  }, [])

  return {
    isOpen,
    position,
    searchText,
    handleSelect,
    handleClose,
  }
}
