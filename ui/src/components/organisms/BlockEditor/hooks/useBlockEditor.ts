import { useReducer, useCallback, useRef, useMemo } from 'react'
import type { Block, BlockType, EditorState, MarkType } from '../../../../types/block'
import { createEmptyBlock } from '../../../../types/block'
import { markdownToBlocks } from '../utils/markdownToBlocks'
import { blocksToMarkdown } from '../utils/blocksToMarkdown'
import {
  insertBlockAfter,
  deleteBlock,
  updateBlock,
  moveBlock,
  convertBlockType,
  splitBlock,
  mergeBlocks,
  indentBlock,
  toggleChecked,
  toggleOpen,
  duplicateBlock,
  getPrevBlockId,
  getNextBlockId,
  applyMark,
  removeMark,
} from '../utils/blockOperations'

// Action types
type EditorAction =
  | { type: 'SET_BLOCKS'; blocks: Block[] }
  | { type: 'UPDATE_BLOCK'; id: string; updates: Partial<Block> }
  | { type: 'INSERT_BLOCK_AFTER'; afterId: string | null; block: Block }
  | { type: 'DELETE_BLOCK'; id: string }
  | { type: 'MOVE_BLOCK'; id: string; toIndex: number }
  | { type: 'CONVERT_BLOCK'; id: string; toType: BlockType }
  | { type: 'SPLIT_BLOCK'; id: string; position: number }
  | { type: 'MERGE_WITH_PREV'; id: string }
  | { type: 'INDENT_BLOCK'; id: string; direction: 'in' | 'out' }
  | { type: 'TOGGLE_CHECKED'; id: string }
  | { type: 'TOGGLE_OPEN'; id: string }
  | { type: 'DUPLICATE_BLOCK'; id: string }
  | { type: 'SET_FOCUS'; blockId: string | null; cursorPosition?: number }
  | { type: 'SELECT_BLOCKS'; ids: string[] }
  | { type: 'APPLY_MARK'; blockId: string; start: number; end: number; markType: MarkType; url?: string }
  | { type: 'REMOVE_MARK'; blockId: string; start: number; end: number; markType: MarkType }

// Reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_BLOCKS':
      return { ...state, blocks: action.blocks }

    case 'UPDATE_BLOCK':
      return {
        ...state,
        blocks: updateBlock(state.blocks, action.id, action.updates),
      }

    case 'INSERT_BLOCK_AFTER':
      return {
        ...state,
        blocks: insertBlockAfter(state.blocks, action.afterId, action.block),
      }

    case 'DELETE_BLOCK': {
      const newBlocks = deleteBlock(state.blocks, action.id)
      // If deleted the focused block, focus previous or next
      let newFocusId = state.focusedBlockId
      if (state.focusedBlockId === action.id) {
        const prevId = getPrevBlockId(state.blocks, action.id)
        const nextId = getNextBlockId(state.blocks, action.id)
        newFocusId = prevId || nextId || null
      }
      return {
        ...state,
        blocks: newBlocks,
        focusedBlockId: newFocusId,
      }
    }

    case 'MOVE_BLOCK':
      return {
        ...state,
        blocks: moveBlock(state.blocks, action.id, action.toIndex),
      }

    case 'CONVERT_BLOCK':
      return {
        ...state,
        blocks: convertBlockType(state.blocks, action.id, action.toType),
      }

    case 'SPLIT_BLOCK': {
      const result = splitBlock(state.blocks, action.id, action.position)
      return {
        ...state,
        blocks: result.blocks,
        focusedBlockId: result.newBlockId,
        cursorPosition: 0,
      }
    }

    case 'MERGE_WITH_PREV': {
      const prevId = getPrevBlockId(state.blocks, action.id)
      if (!prevId) return state

      const result = mergeBlocks(state.blocks, action.id, prevId)
      return {
        ...state,
        blocks: result.blocks,
        focusedBlockId: prevId,
        cursorPosition: result.cursorPosition,
      }
    }

    case 'INDENT_BLOCK':
      return {
        ...state,
        blocks: indentBlock(state.blocks, action.id, action.direction),
      }

    case 'TOGGLE_CHECKED':
      return {
        ...state,
        blocks: toggleChecked(state.blocks, action.id),
      }

    case 'TOGGLE_OPEN':
      return {
        ...state,
        blocks: toggleOpen(state.blocks, action.id),
      }

    case 'DUPLICATE_BLOCK':
      return {
        ...state,
        blocks: duplicateBlock(state.blocks, action.id),
      }

    case 'SET_FOCUS':
      return {
        ...state,
        focusedBlockId: action.blockId,
        cursorPosition: action.cursorPosition ?? state.cursorPosition,
      }

    case 'SELECT_BLOCKS':
      return {
        ...state,
        selectedBlockIds: action.ids,
      }

    case 'APPLY_MARK':
      return {
        ...state,
        blocks: applyMark(state.blocks, action.blockId, action.start, action.end, action.markType, action.url),
      }

    case 'REMOVE_MARK':
      return {
        ...state,
        blocks: removeMark(state.blocks, action.blockId, action.start, action.end, action.markType),
      }

    default:
      return state
  }
}

// Initial state from markdown
function initFromMarkdown(markdown: string): EditorState {
  const blocks = markdownToBlocks(markdown)
  return {
    blocks,
    focusedBlockId: blocks.length > 0 ? blocks[0].id : null,
    cursorPosition: 0,
    selectedBlockIds: [],
  }
}

export function useBlockEditor(initialMarkdown: string) {
  const [state, dispatch] = useReducer(
    editorReducer,
    initialMarkdown,
    initFromMarkdown
  )

  // Refs for DOM elements
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map())
  const editorRef = useRef<HTMLDivElement>(null)

  // Convert blocks to markdown
  const toMarkdown = useCallback(() => {
    return blocksToMarkdown(state.blocks)
  }, [state.blocks])

  // Actions
  const actions = useMemo(
    () => ({
      setBlocks: (blocks: Block[]) => {
        dispatch({ type: 'SET_BLOCKS', blocks })
      },

      updateBlock: (id: string, updates: Partial<Block>) => {
        dispatch({ type: 'UPDATE_BLOCK', id, updates })
      },

      insertBlockAfter: (afterId: string | null, block: Block) => {
        dispatch({ type: 'INSERT_BLOCK_AFTER', afterId, block })
      },

      insertNewBlock: (afterId: string | null, type: BlockType = 'text') => {
        const newBlock = createEmptyBlock(type)
        dispatch({ type: 'INSERT_BLOCK_AFTER', afterId, block: newBlock })
        // Focus the new block
        setTimeout(() => {
          dispatch({ type: 'SET_FOCUS', blockId: newBlock.id, cursorPosition: 0 })
        }, 0)
        return newBlock.id
      },

      deleteBlock: (id: string) => {
        dispatch({ type: 'DELETE_BLOCK', id })
      },

      moveBlock: (id: string, toIndex: number) => {
        dispatch({ type: 'MOVE_BLOCK', id, toIndex })
      },

      convertBlock: (id: string, toType: BlockType) => {
        dispatch({ type: 'CONVERT_BLOCK', id, toType })
      },

      splitBlock: (id: string, position: number) => {
        dispatch({ type: 'SPLIT_BLOCK', id, position })
      },

      mergeWithPrev: (id: string) => {
        dispatch({ type: 'MERGE_WITH_PREV', id })
      },

      indentBlock: (id: string, direction: 'in' | 'out') => {
        dispatch({ type: 'INDENT_BLOCK', id, direction })
      },

      toggleChecked: (id: string) => {
        dispatch({ type: 'TOGGLE_CHECKED', id })
      },

      toggleOpen: (id: string) => {
        dispatch({ type: 'TOGGLE_OPEN', id })
      },

      duplicateBlock: (id: string) => {
        dispatch({ type: 'DUPLICATE_BLOCK', id })
      },

      setFocus: (blockId: string | null, cursorPosition?: number) => {
        dispatch({ type: 'SET_FOCUS', blockId, cursorPosition })
      },

      selectBlocks: (ids: string[]) => {
        dispatch({ type: 'SELECT_BLOCKS', ids })
      },

      focusPrev: (currentId: string) => {
        const prevId = getPrevBlockId(state.blocks, currentId)
        if (prevId) {
          dispatch({ type: 'SET_FOCUS', blockId: prevId })
        }
      },

      focusNext: (currentId: string) => {
        const nextId = getNextBlockId(state.blocks, currentId)
        if (nextId) {
          dispatch({ type: 'SET_FOCUS', blockId: nextId })
        }
      },

      // Reset from new markdown content
      resetFromMarkdown: (markdown: string) => {
        const newState = initFromMarkdown(markdown)
        dispatch({ type: 'SET_BLOCKS', blocks: newState.blocks })
        if (newState.focusedBlockId) {
          dispatch({ type: 'SET_FOCUS', blockId: newState.focusedBlockId })
        }
      },

      // Apply inline mark to selection
      applyMark: (blockId: string, start: number, end: number, markType: MarkType, url?: string) => {
        dispatch({ type: 'APPLY_MARK', blockId, start, end, markType, url })
      },

      // Remove inline mark from selection
      removeMark: (blockId: string, start: number, end: number, markType: MarkType) => {
        dispatch({ type: 'REMOVE_MARK', blockId, start, end, markType })
      },
    }),
    [state.blocks]
  )

  // Register block ref
  const registerBlockRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      blockRefs.current.set(id, element)
    } else {
      blockRefs.current.delete(id)
    }
  }, [])

  // Get block ref
  const getBlockRef = useCallback((id: string) => {
    return blockRefs.current.get(id) || null
  }, [])

  return {
    state,
    actions,
    toMarkdown,
    editorRef,
    registerBlockRef,
    getBlockRef,
  }
}

export type BlockEditorActions = ReturnType<typeof useBlockEditor>['actions']
