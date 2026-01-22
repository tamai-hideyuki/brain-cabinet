// Block type discriminators
export type BlockType =
  | 'text'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'checklist'
  | 'code'
  | 'quote'
  | 'toggle'
  | 'image'
  | 'divider'
  | 'table'

// Inline formatting marks
export type MarkType = 'bold' | 'italic' | 'code' | 'link'

export interface InlineMark {
  type: MarkType
  start: number
  end: number
  url?: string
}

// Base block interface
export interface BaseBlock {
  id: string
  type: BlockType
  indent: number
}

// Text block
export interface TextBlock extends BaseBlock {
  type: 'text'
  content: string
  marks: InlineMark[]
}

// Heading blocks
export interface Heading1Block extends BaseBlock {
  type: 'heading1'
  content: string
  marks: InlineMark[]
}

export interface Heading2Block extends BaseBlock {
  type: 'heading2'
  content: string
  marks: InlineMark[]
}

export interface Heading3Block extends BaseBlock {
  type: 'heading3'
  content: string
  marks: InlineMark[]
}

export type HeadingBlock = Heading1Block | Heading2Block | Heading3Block

// List blocks
export interface BulletListBlock extends BaseBlock {
  type: 'bulletList'
  content: string
  marks: InlineMark[]
}

export interface NumberedListBlock extends BaseBlock {
  type: 'numberedList'
  content: string
  marks: InlineMark[]
}

export interface ChecklistBlock extends BaseBlock {
  type: 'checklist'
  content: string
  marks: InlineMark[]
  checked: boolean
}

// Code block
export interface CodeBlock extends BaseBlock {
  type: 'code'
  content: string
  language: string
}

// Quote block
export interface QuoteBlock extends BaseBlock {
  type: 'quote'
  content: string
  marks: InlineMark[]
}

// Toggle block (collapsible)
export interface ToggleBlock extends BaseBlock {
  type: 'toggle'
  content: string
  marks: InlineMark[]
  isOpen: boolean
  children: Block[]
}

// Image block
export interface ImageBlock extends BaseBlock {
  type: 'image'
  src: string
  alt: string
  caption?: string
}

// Divider block
export interface DividerBlock extends BaseBlock {
  type: 'divider'
}

// Table block
export interface TableCell {
  id: string
  content: string
  marks: InlineMark[]
}

export interface TableRow {
  id: string
  cells: TableCell[]
}

export interface TableBlock extends BaseBlock {
  type: 'table'
  rows: TableRow[]
}

// Union type for all blocks
export type Block =
  | TextBlock
  | Heading1Block
  | Heading2Block
  | Heading3Block
  | BulletListBlock
  | NumberedListBlock
  | ChecklistBlock
  | CodeBlock
  | QuoteBlock
  | ToggleBlock
  | ImageBlock
  | DividerBlock
  | TableBlock

// Editor state
export interface EditorState {
  blocks: Block[]
  focusedBlockId: string | null
  cursorPosition: number
  selectedBlockIds: string[]
}

// Slash command item
export interface SlashCommandItem {
  type: BlockType
  label: string
  description: string
  icon: string
  keywords: string[]
}

// Block with content (helper type)
export type BlockWithContent = Exclude<Block, DividerBlock>

// Helper to check if block has content
export function blockHasContent(block: Block): block is BlockWithContent {
  return block.type !== 'divider'
}

// Helper to check if block has marks
export function blockHasMarks(
  block: Block
): block is Block & { marks: InlineMark[] } {
  return (
    block.type !== 'divider' &&
    block.type !== 'code' &&
    block.type !== 'image' &&
    block.type !== 'table'
  )
}

// Generate unique block ID
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Create empty block
export function createEmptyBlock(type: BlockType): Block {
  const id = generateBlockId()
  const base = { id, indent: 0 }

  switch (type) {
    case 'text':
      return { ...base, type: 'text', content: '', marks: [] }
    case 'heading1':
      return { ...base, type: 'heading1', content: '', marks: [] }
    case 'heading2':
      return { ...base, type: 'heading2', content: '', marks: [] }
    case 'heading3':
      return { ...base, type: 'heading3', content: '', marks: [] }
    case 'bulletList':
      return { ...base, type: 'bulletList', content: '', marks: [] }
    case 'numberedList':
      return { ...base, type: 'numberedList', content: '', marks: [] }
    case 'checklist':
      return { ...base, type: 'checklist', content: '', marks: [], checked: false }
    case 'code':
      return { ...base, type: 'code', content: '', language: '' }
    case 'quote':
      return { ...base, type: 'quote', content: '', marks: [] }
    case 'toggle':
      return { ...base, type: 'toggle', content: '', marks: [], isOpen: true, children: [] }
    case 'image':
      return { ...base, type: 'image', src: '', alt: '' }
    case 'divider':
      return { ...base, type: 'divider' }
    case 'table':
      return {
        ...base,
        type: 'table',
        rows: [
          {
            id: generateBlockId(),
            cells: [
              { id: generateBlockId(), content: '', marks: [] },
              { id: generateBlockId(), content: '', marks: [] },
            ],
          },
          {
            id: generateBlockId(),
            cells: [
              { id: generateBlockId(), content: '', marks: [] },
              { id: generateBlockId(), content: '', marks: [] },
            ],
          },
        ],
      }
  }
}
