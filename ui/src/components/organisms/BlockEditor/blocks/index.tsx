import type { Block } from '../../../../types/block'
import { useBlockEditorContext } from '../BlockEditorContext'
import { TextBlock } from './TextBlock'
import { HeadingBlock } from './HeadingBlock'
import { DividerBlock } from './DividerBlock'
import { QuoteBlock } from './QuoteBlock'
import { BulletListBlock } from './BulletListBlock'
import { NumberedListBlock } from './NumberedListBlock'
import { ChecklistBlock } from './ChecklistBlock'
import { CodeBlockEditor } from './CodeBlockEditor'
import { ImageBlock } from './ImageBlock'
import { ToggleBlock } from './ToggleBlock'
import { TableBlock } from './TableBlock'

type BlockRendererProps = {
  block: Block
  index: number
}

/**
 * Calculate the number for a numbered list item within its consecutive group
 */
const calculateNumberedListNumber = (blocks: Block[], index: number, currentIndent: number): number => {
  let number = 1
  // Count backwards from current position to find consecutive numbered list items at same indent level
  for (let i = index - 1; i >= 0; i--) {
    const prevBlock = blocks[i]
    if (prevBlock.type === 'numberedList' && prevBlock.indent === currentIndent) {
      number++
    } else if (prevBlock.type === 'numberedList' && prevBlock.indent > currentIndent) {
      // Skip nested items
      continue
    } else {
      // Non-numbered list block or different indent level breaks the sequence
      break
    }
  }
  return number
}

/**
 * Render appropriate block component based on block type
 */
export const BlockRenderer = ({ block, index }: BlockRendererProps) => {
  const { state } = useBlockEditorContext()

  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />

    case 'heading1':
    case 'heading2':
    case 'heading3':
      return <HeadingBlock block={block} />

    case 'divider':
      return <DividerBlock block={block} />

    case 'quote':
      return <QuoteBlock block={block} />

    case 'bulletList':
      return <BulletListBlock block={block} />

    case 'numberedList':
      return (
        <NumberedListBlock
          block={block}
          number={calculateNumberedListNumber(state.blocks, index, block.indent)}
        />
      )

    case 'checklist':
      return <ChecklistBlock block={block} />

    case 'code':
      return <CodeBlockEditor block={block} />

    case 'image':
      return <ImageBlock block={block} />

    case 'toggle':
      return <ToggleBlock block={block} />

    case 'table':
      return <TableBlock block={block} />

    default:
      return null
  }
}

export {
  TextBlock,
  HeadingBlock,
  DividerBlock,
  QuoteBlock,
  BulletListBlock,
  NumberedListBlock,
  ChecklistBlock,
  CodeBlockEditor,
  ImageBlock,
  ToggleBlock,
  TableBlock,
}
