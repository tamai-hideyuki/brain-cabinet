import type {
  Block,
  InlineMark,
  TableBlock,
  ToggleBlock,
} from '../../../../types/block'

/**
 * Convert Block array to Markdown string
 */
export function blocksToMarkdown(blocks: Block[]): string {
  const lines: string[] = []
  let prevBlockType: string | null = null

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const md = blockToMarkdown(block)

    // Add blank line before certain block types for better readability
    if (i > 0 && shouldAddBlankLineBefore(block, prevBlockType)) {
      lines.push('')
    }

    lines.push(md)
    prevBlockType = block.type
  }

  return lines.join('\n')
}

/**
 * Determine if a blank line should be added before a block
 */
function shouldAddBlankLineBefore(block: Block, prevType: string | null): boolean {
  if (!prevType) return false

  // Always add blank line before these types
  if (['heading1', 'heading2', 'heading3', 'code', 'table', 'toggle'].includes(block.type)) {
    return true
  }

  // Add blank line when transitioning from list to non-list
  const listTypes = ['bulletList', 'numberedList', 'checklist']
  const prevWasList = listTypes.includes(prevType)
  const currentIsList = listTypes.includes(block.type)

  if (prevWasList && !currentIsList) {
    return true
  }

  // Add blank line between different block types (except consecutive lists)
  if (prevType !== block.type && !currentIsList) {
    return true
  }

  return false
}

/**
 * Convert a single block to Markdown
 */
function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case 'text':
      return applyMarks(block.content, block.marks)

    case 'heading1':
      return `# ${applyMarks(block.content, block.marks)}`

    case 'heading2':
      return `## ${applyMarks(block.content, block.marks)}`

    case 'heading3':
      return `### ${applyMarks(block.content, block.marks)}`

    case 'bulletList': {
      const indent = '  '.repeat(block.indent)
      return `${indent}- ${applyMarks(block.content, block.marks)}`
    }

    case 'numberedList': {
      const indent = '  '.repeat(block.indent)
      return `${indent}1. ${applyMarks(block.content, block.marks)}`
    }

    case 'checklist': {
      const indent = '  '.repeat(block.indent)
      const checkbox = block.checked ? '[x]' : '[ ]'
      return `${indent}- ${checkbox} ${applyMarks(block.content, block.marks)}`
    }

    case 'code':
      return `\`\`\`${block.language}\n${block.content}\n\`\`\``

    case 'quote':
      return `> ${applyMarks(block.content, block.marks)}`

    case 'toggle':
      return toggleToMarkdown(block)

    case 'image': {
      const base = `![${block.alt}](${block.src})`
      return block.caption ? `${base}\n*${block.caption}*` : base
    }

    case 'divider':
      return '---'

    case 'table':
      return tableToMarkdown(block)
  }
}

/**
 * Apply inline marks to text, producing Markdown syntax
 */
function applyMarks(text: string, marks: InlineMark[]): string {
  if (marks.length === 0) return text

  // Sort marks by start position (descending) to apply from end to start
  // This prevents position shifts from affecting subsequent marks
  const sortedMarks = [...marks].sort((a, b) => {
    // If same start, process longer ranges first
    if (a.start === b.start) return b.end - a.end
    return b.start - a.start
  })

  let result = text

  for (const mark of sortedMarks) {
    const before = result.slice(0, mark.start)
    const content = result.slice(mark.start, mark.end)
    const after = result.slice(mark.end)

    switch (mark.type) {
      case 'bold':
        result = `${before}**${content}**${after}`
        break
      case 'italic':
        result = `${before}*${content}*${after}`
        break
      case 'code':
        result = `${before}\`${content}\`${after}`
        break
      case 'link':
        result = `${before}[${content}](${mark.url || ''})${after}`
        break
    }
  }

  return result
}

/**
 * Convert toggle block to Markdown (using HTML details/summary)
 */
function toggleToMarkdown(block: ToggleBlock): string {
  const openAttr = block.isOpen ? ' open' : ''
  const headerText = applyMarks(block.content, block.marks)
  const childrenMd = block.children.length > 0
    ? '\n\n' + blocksToMarkdown(block.children) + '\n'
    : '\n'

  return `<details${openAttr}>\n<summary>${headerText}</summary>${childrenMd}</details>`
}

/**
 * Convert table block to Markdown
 */
function tableToMarkdown(block: TableBlock): string {
  if (block.rows.length === 0) return ''

  const lines: string[] = []

  // Header row
  const headerCells = block.rows[0].cells.map(cell =>
    applyMarks(cell.content, cell.marks)
  )
  lines.push(`| ${headerCells.join(' | ')} |`)

  // Separator row
  lines.push(`| ${headerCells.map(() => '---').join(' | ')} |`)

  // Data rows
  for (let i = 1; i < block.rows.length; i++) {
    const cells = block.rows[i].cells.map(cell =>
      applyMarks(cell.content, cell.marks)
    )
    lines.push(`| ${cells.join(' | ')} |`)
  }

  return lines.join('\n')
}
