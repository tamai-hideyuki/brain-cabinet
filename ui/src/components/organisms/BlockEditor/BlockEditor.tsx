import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBlockEditor } from './hooks/useBlockEditor'
import { useSlashCommand } from './hooks/useSlashCommand'
import { useBlockDragDrop } from './hooks/useBlockDragDrop'
import { useTextSelection } from './hooks/useTextSelection'
import { BlockEditorContext } from './BlockEditorContext'
import { BlockRenderer } from './blocks'
import { SlashCommandMenu } from '../../molecules/SlashCommandMenu'
import { InlineFormatToolbar } from '../../molecules/InlineFormatToolbar'
import type { BlockType, MarkType } from '../../../types/block'
import './BlockEditor.css'

type BlockEditorProps = {
  initialMarkdown: string
  noteId?: string
  onChange?: (markdown: string) => void
  onSave?: (markdown: string) => void
}

export const BlockEditor = ({
  initialMarkdown,
  noteId,
  onChange,
  onSave,
}: BlockEditorProps) => {
  const navigate = useNavigate()
  const {
    state,
    actions,
    toMarkdown,
    editorRef,
    registerBlockRef,
    getBlockRef,
  } = useBlockEditor(initialMarkdown)

  // Slash command
  const {
    isOpen: isSlashMenuOpen,
    position: slashMenuPosition,
    searchText: slashSearchText,
    handleSelect: handleSlashSelect,
    handleClose: handleSlashClose,
  } = useSlashCommand({
    blocks: state.blocks,
    focusedBlockId: state.focusedBlockId,
    getBlockRef,
    onInsertBlock: (type: BlockType) => {
      actions.insertNewBlock(state.focusedBlockId, type)
    },
    onUpdateBlock: actions.updateBlock,
    onConvertBlock: actions.convertBlock,
    onSetFocus: actions.setFocus,
  })

  // Drag and drop
  const {
    draggedId,
    dropTargetIndex,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  } = useBlockDragDrop({
    blocks: state.blocks,
    onMoveBlock: actions.moveBlock,
  })

  // Text selection for inline formatting
  const { selection } = useTextSelection({
    editorRef,
    getBlockRef,
    focusedBlockId: state.focusedBlockId,
  })

  // Get current block's marks for the toolbar
  const currentBlockMarks = useMemo(() => {
    if (!selection) return []
    const block = state.blocks.find(b => b.id === selection.blockId)
    if (!block || !('marks' in block)) return []
    return block.marks || []
  }, [selection, state.blocks])

  // Handle applying/removing marks
  const handleApplyMark = useCallback(
    (type: MarkType, url?: string) => {
      if (!selection) return
      actions.applyMark(selection.blockId, selection.start, selection.end, type, url)
    },
    [selection, actions]
  )

  const handleRemoveMark = useCallback(
    (type: MarkType) => {
      if (!selection) return
      actions.removeMark(selection.blockId, selection.start, selection.end, type)
    },
    [selection, actions]
  )

  // Notify parent of changes (skip initial render)
  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    if (onChange) {
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false
        return
      }
      const markdown = toMarkdown()
      onChange(markdown)
    }
  }, [state.blocks, onChange, toMarkdown])

  // Handle save shortcut (Cmd/Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (onSave) {
          onSave(toMarkdown())
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onSave, toMarkdown])

  // Focus management
  useEffect(() => {
    if (state.focusedBlockId) {
      const element = getBlockRef(state.focusedBlockId)
      if (element) {
        const editable = element.querySelector('[contenteditable="true"]') as HTMLElement
        const input = element.querySelector('input, textarea') as HTMLElement
        const focusTarget = editable || input
        if (focusTarget && document.activeElement !== focusTarget) {
          focusTarget.focus()
        }
      }
    }
  }, [state.focusedBlockId, getBlockRef])

  const handleEditorClick = useCallback(
    (e: React.MouseEvent) => {
      // If clicked on empty area, focus last block or create new one
      if (e.target === editorRef.current) {
        const lastBlock = state.blocks[state.blocks.length - 1]
        if (lastBlock) {
          actions.setFocus(lastBlock.id)
        }
      }
    },
    [state.blocks, actions, editorRef]
  )

  const handleLinkClick = useCallback(
    (href: string) => {
      if (href.startsWith('note://')) {
        const uuid = href.replace('note://', '')
        navigate(`/ui/notes/${uuid}`)
      } else {
        window.open(href, '_blank', 'noopener,noreferrer')
      }
    },
    [navigate]
  )

  return (
    <BlockEditorContext.Provider
      value={{
        state,
        actions,
        registerBlockRef,
        getBlockRef,
        noteId,
        isSlashMenuOpen,
        onLinkClick: handleLinkClick,
      }}
    >
      <div
        ref={editorRef}
        className="block-editor"
        onClick={handleEditorClick}
      >
        {state.blocks.map((block, index) => (
          <div
            key={block.id}
            className={`block-editor__block-wrapper ${
              draggedId === block.id ? 'block-editor__block-wrapper--dragging' : ''
            } ${
              dropTargetIndex === index ? 'block-editor__block-wrapper--drop-target' : ''
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, block.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <div className="block-editor__drag-handle">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <circle cx="4" cy="3" r="1.5" />
                <circle cx="10" cy="3" r="1.5" />
                <circle cx="4" cy="7" r="1.5" />
                <circle cx="10" cy="7" r="1.5" />
                <circle cx="4" cy="11" r="1.5" />
                <circle cx="10" cy="11" r="1.5" />
              </svg>
            </div>
            <div className="block-editor__block-content">
              <BlockRenderer block={block} index={index} />
            </div>
          </div>
        ))}

        {/* Drop target at end */}
        <div
          className={`block-editor__end-drop-zone ${
            dropTargetIndex === state.blocks.length ? 'block-editor__end-drop-zone--active' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, state.blocks.length)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, state.blocks.length)}
        />

        {/* Slash command menu */}
        <SlashCommandMenu
          isOpen={isSlashMenuOpen}
          position={slashMenuPosition}
          searchText={slashSearchText}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
        />

        {/* Inline format toolbar */}
        <InlineFormatToolbar
          selection={selection}
          marks={currentBlockMarks}
          onApplyMark={handleApplyMark}
          onRemoveMark={handleRemoveMark}
        />
      </div>
    </BlockEditorContext.Provider>
  )
}
