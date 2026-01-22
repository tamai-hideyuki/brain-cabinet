import { useState, useCallback } from 'react'
import type { Block } from '../../../../types/block'

type UseBlockDragDropOptions = {
  blocks: Block[]
  onMoveBlock: (id: string, toIndex: number) => void
}

export function useBlockDragDrop({ blocks, onMoveBlock }: UseBlockDragDropOptions) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent, blockId: string) => {
      setDraggedId(blockId)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', blockId)

      // Set drag image
      const element = e.currentTarget as HTMLElement
      if (element) {
        const rect = element.getBoundingClientRect()
        e.dataTransfer.setDragImage(element, rect.width / 2, 10)
      }
    },
    []
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'

      if (draggedId) {
        const draggedIndex = blocks.findIndex(b => b.id === draggedId)
        // Don't show drop indicator on itself
        if (draggedIndex !== targetIndex && draggedIndex !== targetIndex - 1) {
          setDropTargetIndex(targetIndex)
        } else {
          setDropTargetIndex(null)
        }
      }
    },
    [draggedId, blocks]
  )

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault()

      if (draggedId) {
        const draggedIndex = blocks.findIndex(b => b.id === draggedId)
        if (draggedIndex !== -1 && draggedIndex !== targetIndex) {
          // Adjust index if dragging downward
          const adjustedIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex
          onMoveBlock(draggedId, adjustedIndex)
        }
      }

      setDraggedId(null)
      setDropTargetIndex(null)
    },
    [draggedId, blocks, onMoveBlock]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDropTargetIndex(null)
  }, [])

  return {
    draggedId,
    dropTargetIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  }
}
