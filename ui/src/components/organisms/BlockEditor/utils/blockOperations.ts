import type { Block, BlockType, InlineMark, MarkType } from '../../../../types/block'
import { generateBlockId, createEmptyBlock } from '../../../../types/block'

/**
 * Insert a block after the specified block ID
 */
export function insertBlockAfter(
  blocks: Block[],
  afterId: string | null,
  newBlock: Block
): Block[] {
  if (afterId === null) {
    return [newBlock, ...blocks]
  }

  const index = blocks.findIndex(b => b.id === afterId)
  if (index === -1) {
    return [...blocks, newBlock]
  }

  return [
    ...blocks.slice(0, index + 1),
    newBlock,
    ...blocks.slice(index + 1),
  ]
}

/**
 * Delete a block by ID
 */
export function deleteBlock(blocks: Block[], blockId: string): Block[] {
  return blocks.filter(b => b.id !== blockId)
}

/**
 * Update a block by ID
 */
export function updateBlock(
  blocks: Block[],
  blockId: string,
  updates: Partial<Block>
): Block[] {
  return blocks.map(block =>
    block.id === blockId ? { ...block, ...updates } as Block : block
  )
}

/**
 * Move a block to a new index
 */
export function moveBlock(
  blocks: Block[],
  blockId: string,
  toIndex: number
): Block[] {
  const fromIndex = blocks.findIndex(b => b.id === blockId)
  if (fromIndex === -1) return blocks

  const newBlocks = [...blocks]
  const [removed] = newBlocks.splice(fromIndex, 1)

  // Adjust index if moving down
  const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
  newBlocks.splice(Math.max(0, Math.min(adjustedIndex, newBlocks.length)), 0, removed)

  return newBlocks
}

/**
 * Convert a block to a different type
 */
export function convertBlockType(
  blocks: Block[],
  blockId: string,
  toType: BlockType
): Block[] {
  return blocks.map(block => {
    if (block.id !== blockId) return block

    // Get content and marks from current block if it has them
    let content = ''
    let marks: InlineMark[] = []

    if ('content' in block && typeof block.content === 'string') {
      content = block.content
    }
    if ('marks' in block && Array.isArray(block.marks)) {
      marks = block.marks
    }

    // Create new block of target type
    const base = { id: block.id, indent: block.indent }

    switch (toType) {
      case 'text':
        return { ...base, type: 'text', content, marks }
      case 'heading1':
        return { ...base, type: 'heading1', content, marks }
      case 'heading2':
        return { ...base, type: 'heading2', content, marks }
      case 'heading3':
        return { ...base, type: 'heading3', content, marks }
      case 'bulletList':
        return { ...base, type: 'bulletList', content, marks }
      case 'numberedList':
        return { ...base, type: 'numberedList', content, marks }
      case 'checklist':
        return { ...base, type: 'checklist', content, marks, checked: false }
      case 'code':
        return { ...base, type: 'code', content, language: '' }
      case 'quote':
        return { ...base, type: 'quote', content, marks }
      case 'toggle':
        return { ...base, type: 'toggle', content, marks, isOpen: true, children: [] }
      case 'divider':
        return { ...base, type: 'divider' }
      case 'image':
        return { ...base, type: 'image', src: '', alt: content }
      case 'table':
        return createEmptyBlock('table')
      default:
        return block
    }
  })
}

/**
 * Split a block at cursor position
 */
export function splitBlock(
  blocks: Block[],
  blockId: string,
  position: number
): { blocks: Block[]; newBlockId: string } {
  const index = blocks.findIndex(b => b.id === blockId)
  if (index === -1) {
    const newBlock = createEmptyBlock('text')
    return { blocks: [...blocks, newBlock], newBlockId: newBlock.id }
  }

  const block = blocks[index]

  // Can't split non-content blocks
  if (!('content' in block) || typeof block.content !== 'string') {
    const newBlock = createEmptyBlock('text')
    return {
      blocks: insertBlockAfter(blocks, blockId, newBlock),
      newBlockId: newBlock.id,
    }
  }

  const beforeContent = block.content.slice(0, position)
  const afterContent = block.content.slice(position)

  // Split marks
  const beforeMarks: InlineMark[] = []
  const afterMarks: InlineMark[] = []

  if ('marks' in block && Array.isArray(block.marks)) {
    for (const mark of block.marks) {
      if (mark.end <= position) {
        // Mark is entirely before split point
        beforeMarks.push(mark)
      } else if (mark.start >= position) {
        // Mark is entirely after split point
        afterMarks.push({
          ...mark,
          start: mark.start - position,
          end: mark.end - position,
        })
      } else {
        // Mark spans the split point - split it
        beforeMarks.push({ ...mark, end: position })
        afterMarks.push({
          ...mark,
          start: 0,
          end: mark.end - position,
        })
      }
    }
  }

  // Update current block
  const updatedBlock = {
    ...block,
    content: beforeContent,
    marks: beforeMarks,
  } as Block

  // Create new block (same type for lists, text for others)
  const listTypes = ['bulletList', 'numberedList', 'checklist']
  const newBlockType = listTypes.includes(block.type) ? block.type : 'text'
  const newBlock = {
    ...createEmptyBlock(newBlockType as BlockType),
    indent: block.indent,
    content: afterContent,
    marks: afterMarks,
  } as Block

  // For checklist, reset checked state on new block
  if (newBlockType === 'checklist') {
    (newBlock as any).checked = false
  }

  const newBlocks = [
    ...blocks.slice(0, index),
    updatedBlock,
    newBlock,
    ...blocks.slice(index + 1),
  ]

  return { blocks: newBlocks, newBlockId: newBlock.id }
}

/**
 * Merge two blocks (source into target)
 */
export function mergeBlocks(
  blocks: Block[],
  sourceId: string,
  targetId: string
): { blocks: Block[]; cursorPosition: number } {
  const sourceIndex = blocks.findIndex(b => b.id === sourceId)
  const targetIndex = blocks.findIndex(b => b.id === targetId)

  if (sourceIndex === -1 || targetIndex === -1) {
    return { blocks, cursorPosition: 0 }
  }

  const source = blocks[sourceIndex]
  const target = blocks[targetIndex]

  // Can't merge into non-content blocks
  if (!('content' in target) || typeof target.content !== 'string') {
    return { blocks: deleteBlock(blocks, sourceId), cursorPosition: 0 }
  }

  const targetContent = target.content
  const cursorPosition = targetContent.length

  // Get source content
  let sourceContent = ''
  let sourceMarks: InlineMark[] = []

  if ('content' in source && typeof source.content === 'string') {
    sourceContent = source.content
  }
  if ('marks' in source && Array.isArray(source.marks)) {
    sourceMarks = source.marks
  }

  // Merge marks (adjust source mark positions)
  const targetMarks = 'marks' in target && Array.isArray(target.marks) ? target.marks : []
  const adjustedSourceMarks = sourceMarks.map(mark => ({
    ...mark,
    start: mark.start + cursorPosition,
    end: mark.end + cursorPosition,
  }))

  const mergedBlock = {
    ...target,
    content: targetContent + sourceContent,
    marks: [...targetMarks, ...adjustedSourceMarks],
  } as Block

  const newBlocks = blocks
    .filter(b => b.id !== sourceId)
    .map(b => (b.id === targetId ? mergedBlock : b))

  return { blocks: newBlocks, cursorPosition }
}

/**
 * Indent a block (increase indent level)
 */
export function indentBlock(
  blocks: Block[],
  blockId: string,
  direction: 'in' | 'out'
): Block[] {
  return blocks.map(block => {
    if (block.id !== blockId) return block

    const newIndent = direction === 'in'
      ? Math.min(block.indent + 1, 4) // Max indent of 4
      : Math.max(block.indent - 1, 0)

    return { ...block, indent: newIndent }
  })
}

/**
 * Toggle checkbox for checklist block
 */
export function toggleChecked(blocks: Block[], blockId: string): Block[] {
  return blocks.map(block => {
    if (block.id !== blockId || block.type !== 'checklist') return block
    return { ...block, checked: !block.checked }
  })
}

/**
 * Toggle open state for toggle block
 */
export function toggleOpen(blocks: Block[], blockId: string): Block[] {
  return blocks.map(block => {
    if (block.id !== blockId || block.type !== 'toggle') return block
    return { ...block, isOpen: !block.isOpen }
  })
}

/**
 * Duplicate a block
 */
export function duplicateBlock(blocks: Block[], blockId: string): Block[] {
  const index = blocks.findIndex(b => b.id === blockId)
  if (index === -1) return blocks

  const block = blocks[index]
  const duplicated = {
    ...JSON.parse(JSON.stringify(block)),
    id: generateBlockId(),
  }

  // Regenerate IDs for nested structures
  if (duplicated.type === 'toggle' && duplicated.children) {
    duplicated.children = duplicated.children.map((child: Block) => ({
      ...child,
      id: generateBlockId(),
    }))
  }
  if (duplicated.type === 'table' && duplicated.rows) {
    duplicated.rows = duplicated.rows.map((row: any) => ({
      ...row,
      id: generateBlockId(),
      cells: row.cells.map((cell: any) => ({
        ...cell,
        id: generateBlockId(),
      })),
    }))
  }

  return insertBlockAfter(blocks, blockId, duplicated)
}

/**
 * Get the previous block ID
 */
export function getPrevBlockId(blocks: Block[], currentId: string): string | null {
  const index = blocks.findIndex(b => b.id === currentId)
  if (index <= 0) return null
  return blocks[index - 1].id
}

/**
 * Get the next block ID
 */
export function getNextBlockId(blocks: Block[], currentId: string): string | null {
  const index = blocks.findIndex(b => b.id === currentId)
  if (index === -1 || index >= blocks.length - 1) return null
  return blocks[index + 1].id
}

/**
 * Apply a mark to a selection range in a block
 */
export function applyMark(
  blocks: Block[],
  blockId: string,
  start: number,
  end: number,
  type: MarkType,
  url?: string
): Block[] {
  return blocks.map(block => {
    if (block.id !== blockId) return block
    if (!('marks' in block) || !Array.isArray(block.marks)) return block

    const newMark: InlineMark = { type, start, end }
    if (url && type === 'link') {
      newMark.url = url
    }

    // Merge overlapping marks of the same type
    const existingMarks = block.marks.filter(m => m.type !== type)
    const sameTypeMarks = block.marks.filter(m => m.type === type)

    // Add new mark and merge with overlapping same-type marks
    let mergedMark = { ...newMark }
    const nonOverlapping: InlineMark[] = []

    for (const mark of sameTypeMarks) {
      if (mark.end < mergedMark.start || mark.start > mergedMark.end) {
        // No overlap
        nonOverlapping.push(mark)
      } else {
        // Overlap - extend the merged mark
        mergedMark = {
          ...mergedMark,
          start: Math.min(mergedMark.start, mark.start),
          end: Math.max(mergedMark.end, mark.end),
        }
      }
    }

    const newMarks = [...existingMarks, ...nonOverlapping, mergedMark]
    // Sort marks by start position
    newMarks.sort((a, b) => a.start - b.start)

    return { ...block, marks: newMarks } as Block
  })
}

/**
 * Remove a mark type from a selection range in a block
 */
export function removeMark(
  blocks: Block[],
  blockId: string,
  start: number,
  end: number,
  type: MarkType
): Block[] {
  return blocks.map(block => {
    if (block.id !== blockId) return block
    if (!('marks' in block) || !Array.isArray(block.marks)) return block

    const newMarks: InlineMark[] = []

    for (const mark of block.marks) {
      if (mark.type !== type) {
        // Keep marks of different types
        newMarks.push(mark)
      } else if (mark.end <= start || mark.start >= end) {
        // Mark is outside selection - keep it
        newMarks.push(mark)
      } else if (mark.start >= start && mark.end <= end) {
        // Mark is entirely within selection - remove it
        // (don't add to newMarks)
      } else if (mark.start < start && mark.end > end) {
        // Selection is inside the mark - split it
        newMarks.push({ ...mark, end: start })
        newMarks.push({ ...mark, start: end })
      } else if (mark.start < start) {
        // Mark starts before selection - truncate
        newMarks.push({ ...mark, end: start })
      } else {
        // Mark ends after selection - truncate
        newMarks.push({ ...mark, start: end })
      }
    }

    // Sort marks by start position
    newMarks.sort((a, b) => a.start - b.start)

    return { ...block, marks: newMarks } as Block
  })
}
