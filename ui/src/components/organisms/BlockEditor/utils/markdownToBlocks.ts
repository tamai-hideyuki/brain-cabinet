import type {
  Block,
  InlineMark,
  BlockType,
} from '../../../../types/block'
import { generateBlockId } from '../../../../types/block'

/**
 * Parse Markdown string to Block array
 * Uses a simple line-by-line parser instead of AST for simplicity
 */
export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Empty line - skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Code block (fenced)
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({
        id: generateBlockId(),
        type: 'code',
        indent: 0,
        content: codeLines.join('\n'),
        language,
      })
      i++ // Skip closing ```
      continue
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({
        id: generateBlockId(),
        type: 'divider',
        indent: 0,
      })
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      const { text, marks } = parseInlineMarks(headingMatch[2])
      const type: BlockType = `heading${level}` as BlockType
      blocks.push({
        id: generateBlockId(),
        type,
        indent: 0,
        content: text,
        marks,
      } as Block)
      i++
      continue
    }

    // Quote
    if (line.startsWith('>')) {
      const content = line.replace(/^>\s*/, '')
      const { text, marks } = parseInlineMarks(content)
      blocks.push({
        id: generateBlockId(),
        type: 'quote',
        indent: 0,
        content: text,
        marks,
      })
      i++
      continue
    }

    // Checklist
    const checklistMatch = line.match(/^(\s*)- \[([ xX])\]\s*(.*)$/)
    if (checklistMatch) {
      const indent = Math.floor(checklistMatch[1].length / 2)
      const checked = checklistMatch[2].toLowerCase() === 'x'
      const { text, marks } = parseInlineMarks(checklistMatch[3])
      blocks.push({
        id: generateBlockId(),
        type: 'checklist',
        indent,
        content: text,
        marks,
        checked,
      })
      i++
      continue
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2)
      const { text, marks } = parseInlineMarks(bulletMatch[2])
      blocks.push({
        id: generateBlockId(),
        type: 'bulletList',
        indent,
        content: text,
        marks,
      })
      i++
      continue
    }

    // Numbered list
    const numberedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/)
    if (numberedMatch) {
      const indent = Math.floor(numberedMatch[1].length / 2)
      const { text, marks } = parseInlineMarks(numberedMatch[2])
      blocks.push({
        id: generateBlockId(),
        type: 'numberedList',
        indent,
        content: text,
        marks,
      })
      i++
      continue
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [line]
      i++
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      const tableBlock = parseTable(tableLines)
      if (tableBlock) {
        blocks.push(tableBlock)
      }
      continue
    }

    // Toggle (HTML details/summary)
    if (line.trim().startsWith('<details')) {
      const isOpen = line.includes('open')
      const toggleLines: string[] = []
      i++
      let summaryContent = ''

      // Find summary
      while (i < lines.length) {
        const currentLine = lines[i]
        if (currentLine.includes('<summary>')) {
          const summaryMatch = currentLine.match(/<summary>(.*?)<\/summary>/)
          if (summaryMatch) {
            summaryContent = summaryMatch[1]
          }
          i++
          break
        }
        i++
      }

      // Collect content until </details>
      while (i < lines.length && !lines[i].includes('</details>')) {
        if (lines[i].trim() !== '') {
          toggleLines.push(lines[i])
        }
        i++
      }

      const { text, marks } = parseInlineMarks(summaryContent)
      const children = markdownToBlocks(toggleLines.join('\n'))

      blocks.push({
        id: generateBlockId(),
        type: 'toggle',
        indent: 0,
        content: text,
        marks,
        isOpen,
        children,
      })
      i++ // Skip </details>
      continue
    }

    // Image
    const imageMatch = line.match(/^!\[(.*?)\]\((.*?)\)$/)
    if (imageMatch) {
      blocks.push({
        id: generateBlockId(),
        type: 'image',
        indent: 0,
        src: imageMatch[2],
        alt: imageMatch[1],
      })
      i++
      continue
    }

    // Default: text paragraph
    const { text, marks } = parseInlineMarks(line)
    blocks.push({
      id: generateBlockId(),
      type: 'text',
      indent: 0,
      content: text,
      marks,
    })
    i++
  }

  // If no blocks, return empty text block
  if (blocks.length === 0) {
    blocks.push({
      id: generateBlockId(),
      type: 'text',
      indent: 0,
      content: '',
      marks: [],
    })
  }

  return blocks
}

/**
 * Parse inline marks (bold, italic, code, link) from text
 */
function parseInlineMarks(text: string): { text: string; marks: InlineMark[] } {
  const marks: InlineMark[] = []
  let result = text

  // Process patterns in order: links, bold, italic, code
  // We need to track position adjustments as we remove markers

  // Links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let linkMatch
  while ((linkMatch = linkRegex.exec(text)) !== null) {
    const fullMatch = linkMatch[0]
    const linkText = linkMatch[1]
    const url = linkMatch[2]

    // Find position in result string
    const startInResult = result.indexOf(fullMatch)
    if (startInResult !== -1) {
      result = result.replace(fullMatch, linkText)
      marks.push({
        type: 'link',
        start: startInResult,
        end: startInResult + linkText.length,
        url,
      })
    }
  }

  // Bold: **text** or __text__
  const boldRegex = /\*\*([^*]+)\*\*|__([^_]+)__/g
  let boldMatch
  while ((boldMatch = boldRegex.exec(result)) !== null) {
    const fullMatch = boldMatch[0]
    const boldText = boldMatch[1] || boldMatch[2]
    const startInResult = result.indexOf(fullMatch)
    if (startInResult !== -1) {
      result = result.replace(fullMatch, boldText)
      marks.push({
        type: 'bold',
        start: startInResult,
        end: startInResult + boldText.length,
      })
      // Reset regex since string changed
      boldRegex.lastIndex = 0
    }
  }

  // Italic: *text* or _text_ (but not ** or __)
  const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)|(?<!_)_([^_]+)_(?!_)/g
  let italicMatch
  while ((italicMatch = italicRegex.exec(result)) !== null) {
    const fullMatch = italicMatch[0]
    const italicText = italicMatch[1] || italicMatch[2]
    const startInResult = result.indexOf(fullMatch)
    if (startInResult !== -1) {
      result = result.replace(fullMatch, italicText)
      marks.push({
        type: 'italic',
        start: startInResult,
        end: startInResult + italicText.length,
      })
      italicRegex.lastIndex = 0
    }
  }

  // Inline code: `text`
  const codeRegex = /`([^`]+)`/g
  let codeMatch
  while ((codeMatch = codeRegex.exec(result)) !== null) {
    const fullMatch = codeMatch[0]
    const codeText = codeMatch[1]
    const startInResult = result.indexOf(fullMatch)
    if (startInResult !== -1) {
      result = result.replace(fullMatch, codeText)
      marks.push({
        type: 'code',
        start: startInResult,
        end: startInResult + codeText.length,
      })
      codeRegex.lastIndex = 0
    }
  }

  return { text: result, marks }
}

/**
 * Parse markdown table
 */
function parseTable(lines: string[]): Block | null {
  if (lines.length < 2) return null

  // Filter out separator row (contains only |, -, :, space)
  const dataLines = lines.filter(line => !/^[\s|:-]+$/.test(line))

  if (dataLines.length === 0) return null

  const rows = dataLines.map(line => {
    const cells = line
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '')

    return {
      id: generateBlockId(),
      cells: cells.map(cellContent => {
        const { text, marks } = parseInlineMarks(cellContent)
        return {
          id: generateBlockId(),
          content: text,
          marks,
        }
      }),
    }
  })

  return {
    id: generateBlockId(),
    type: 'table',
    indent: 0,
    rows,
  }
}
