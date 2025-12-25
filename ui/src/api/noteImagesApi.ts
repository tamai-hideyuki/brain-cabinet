/**
 * ノート画像 API
 */
import { fetchWithAuth } from './client'

const API_BASE = '/api/notes'

export type NoteImageMeta = {
  id: string
  noteId: string
  name: string
  mimeType: string
  size: number
  createdAt: number
}

export type NoteImageUploadResult = NoteImageMeta & {
  markdown: string
}

/**
 * 画像をアップロード
 */
export const uploadNoteImage = async (
  noteId: string,
  file: File,
  name?: string
): Promise<NoteImageUploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  if (name) {
    formData.append('name', name)
  }

  const res = await fetchWithAuth(`${API_BASE}/${noteId}/images`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to upload image')
  }

  return res.json()
}

/**
 * ノートの画像一覧を取得
 */
export const getNoteImages = async (noteId: string): Promise<NoteImageMeta[]> => {
  const res = await fetchWithAuth(`${API_BASE}/${noteId}/images`)

  if (!res.ok) {
    throw new Error('Failed to get note images')
  }

  return res.json()
}

/**
 * 画像を削除
 */
export const deleteNoteImage = async (imageId: string): Promise<NoteImageMeta> => {
  const res = await fetchWithAuth(`${API_BASE}/images/${imageId}`, {
    method: 'DELETE',
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete image')
  }

  return res.json()
}

/**
 * 画像データのURLを取得
 */
export const getNoteImageUrl = (imageId: string): string => {
  return `${API_BASE}/images/${imageId}/data`
}
