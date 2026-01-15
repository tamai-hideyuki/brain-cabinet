/**
 * Note Actions Adapter
 * API呼び出しと型変換を担当
 */

import { updateNote, deleteNote } from '../api/notesApi'
import { createBookmarkNode } from '../api/bookmarkApi'

/**
 * ノートをブックマークに追加
 */
export const addNoteToBookmark = async (
  noteId: string,
  noteTitle: string
): Promise<void> => {
  await createBookmarkNode({
    type: 'note',
    name: noteTitle,
    noteId,
  })
}

/**
 * ノートにリンクを追加
 */
export const addLinkToNote = async (
  noteId: string,
  noteTitle: string,
  noteContent: string,
  targetNoteId: string
): Promise<void> => {
  const linkText = `\n\n[[${targetNoteId}]]`
  const newContent = noteContent + linkText
  await updateNote(noteId, noteTitle, newContent)
}

/**
 * ノートを削除
 */
export const removeNote = async (noteId: string): Promise<void> => {
  await deleteNote(noteId)
}
