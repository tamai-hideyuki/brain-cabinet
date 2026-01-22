import { createContext, useContext } from 'react'
import type { EditorState } from '../../../types/block'
import type { BlockEditorActions } from './hooks/useBlockEditor'

export interface BlockEditorContextValue {
  state: EditorState
  actions: BlockEditorActions
  registerBlockRef: (id: string, element: HTMLElement | null) => void
  getBlockRef: (id: string) => HTMLElement | null
  noteId?: string // For image uploads
  isSlashMenuOpen: boolean // To prevent arrow key navigation when menu is open
  onLinkClick: (href: string) => void
}

export const BlockEditorContext = createContext<BlockEditorContextValue | null>(null)

export function useBlockEditorContext() {
  const context = useContext(BlockEditorContext)
  if (!context) {
    throw new Error('useBlockEditorContext must be used within a BlockEditorProvider')
  }
  return context
}
