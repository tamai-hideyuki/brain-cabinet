import { useState, useCallback, useEffect, useRef } from 'react'
import type { SelectionInfo } from '../../../molecules/InlineFormatToolbar'

type UseTextSelectionOptions = {
  editorRef: React.RefObject<HTMLDivElement | null>
  getBlockRef: (id: string) => HTMLElement | null
  focusedBlockId: string | null
}

export function useTextSelection({
  editorRef,
  getBlockRef,
  focusedBlockId,
}: UseTextSelectionOptions) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const isSelecting = useRef(false)

  const getSelectionInfo = useCallback((): SelectionInfo | null => {
    const windowSelection = window.getSelection()
    if (!windowSelection || windowSelection.isCollapsed) {
      return null
    }

    // Only handle selection within editor
    if (!editorRef.current) return null

    // Check if selection is within the editor
    const anchorNode = windowSelection.anchorNode
    const focusNode = windowSelection.focusNode
    if (
      !anchorNode ||
      !focusNode ||
      !editorRef.current.contains(anchorNode) ||
      !editorRef.current.contains(focusNode)
    ) {
      return null
    }

    // Find the block element containing the selection
    if (!focusedBlockId) return null
    const blockElement = getBlockRef(focusedBlockId)
    if (!blockElement) return null

    // Check if selection is within the focused block
    const editableElement = blockElement.querySelector('[contenteditable="true"]')
    if (!editableElement) return null
    if (
      !editableElement.contains(anchorNode) ||
      !editableElement.contains(focusNode)
    ) {
      return null
    }

    // Calculate selection range in terms of text content
    const range = windowSelection.getRangeAt(0)
    const preSelectionRange = range.cloneRange()
    preSelectionRange.selectNodeContents(editableElement)
    preSelectionRange.setEnd(range.startContainer, range.startOffset)
    const start = preSelectionRange.toString().length

    const end = start + range.toString().length

    // Get selection rect
    const rect = range.getBoundingClientRect()

    return {
      blockId: focusedBlockId,
      start,
      end,
      rect,
    }
  }, [editorRef, getBlockRef, focusedBlockId])

  const updateSelection = useCallback(() => {
    const info = getSelectionInfo()
    setSelection(info)
  }, [getSelectionInfo])

  const clearSelection = useCallback(() => {
    setSelection(null)
  }, [])

  // Handle mouseup to detect selection
  useEffect(() => {
    const handleMouseDown = () => {
      isSelecting.current = true
    }

    const handleMouseUp = () => {
      if (isSelecting.current) {
        // Small delay to let the browser finalize selection
        setTimeout(updateSelection, 10)
        isSelecting.current = false
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Update selection on shift+arrow keys
      if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        updateSelection()
      }
    }

    const handleSelectionChange = () => {
      // Only update if not actively selecting with mouse
      if (!isSelecting.current) {
        updateSelection()
      }
    }

    const editor = editorRef.current
    if (editor) {
      editor.addEventListener('mousedown', handleMouseDown)
      editor.addEventListener('mouseup', handleMouseUp)
      editor.addEventListener('keyup', handleKeyUp)
      document.addEventListener('selectionchange', handleSelectionChange)
    }

    return () => {
      if (editor) {
        editor.removeEventListener('mousedown', handleMouseDown)
        editor.removeEventListener('mouseup', handleMouseUp)
        editor.removeEventListener('keyup', handleKeyUp)
        document.removeEventListener('selectionchange', handleSelectionChange)
      }
    }
  }, [editorRef, updateSelection])

  // Clear selection when focused block changes
  useEffect(() => {
    clearSelection()
  }, [focusedBlockId, clearSelection])

  return {
    selection,
    clearSelection,
    updateSelection,
  }
}
