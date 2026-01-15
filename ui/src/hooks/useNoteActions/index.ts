import { useState, useCallback } from 'react'
import * as noteActionsAdapter from '../../adapters/noteActionsAdapter'
import type { Note } from '../../types/note'

export const useNoteActions = (note: Note | null, onSuccess?: () => void) => {
  const [bookmarkAdding, setBookmarkAdding] = useState(false)
  const [addingLinkNoteId, setAddingLinkNoteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const addBookmark = useCallback(async () => {
    if (!note) return

    setBookmarkAdding(true)
    try {
      await noteActionsAdapter.addNoteToBookmark(note.id, note.title)
      return true
    } catch (e) {
      console.error('Failed to add bookmark:', e)
      throw e
    } finally {
      setBookmarkAdding(false)
    }
  }, [note])

  const addLink = useCallback(async (targetNoteId: string) => {
    if (!note) return

    setAddingLinkNoteId(targetNoteId)
    try {
      await noteActionsAdapter.addLinkToNote(note.id, note.title, note.content, targetNoteId)
      onSuccess?.()
    } catch (e) {
      console.error('Failed to add link:', e)
      throw e
    } finally {
      setAddingLinkNoteId(null)
    }
  }, [note, onSuccess])

  const remove = useCallback(async () => {
    if (!note) return

    setDeleting(true)
    try {
      await noteActionsAdapter.removeNote(note.id)
      return true
    } catch (e) {
      console.error('Failed to delete note:', e)
      throw e
    } finally {
      setDeleting(false)
    }
  }, [note])

  return {
    bookmarkAdding,
    addingLinkNoteId,
    deleting,
    addBookmark,
    addLink,
    remove,
  }
}
