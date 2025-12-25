import type {
  BookmarkNode,
  CreateBookmarkParams,
  UpdateBookmarkParams,
  MoveBookmarkParams,
} from '../types/bookmark'
import { fetchWithAuth } from './client'

const API_BASE = '/api/bookmarks'

// ブックマークツリー取得
export const fetchBookmarkTree = async (): Promise<BookmarkNode[]> => {
  const res = await fetchWithAuth(API_BASE)
  if (!res.ok) throw new Error('Failed to fetch bookmark tree')
  return res.json()
}

// 単一ノード取得
export const fetchBookmarkNode = async (id: string): Promise<BookmarkNode> => {
  const res = await fetchWithAuth(`${API_BASE}/${id}`)
  if (!res.ok) throw new Error('Failed to fetch bookmark node')
  return res.json()
}

// ノード作成
export const createBookmarkNode = async (
  params: CreateBookmarkParams
): Promise<BookmarkNode> => {
  const res = await fetchWithAuth(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to create bookmark node')
  return res.json()
}

// ノード更新
export const updateBookmarkNode = async (
  id: string,
  params: UpdateBookmarkParams
): Promise<BookmarkNode> => {
  const res = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to update bookmark node')
  return res.json()
}

// ノード削除
export const deleteBookmarkNode = async (id: string): Promise<void> => {
  const res = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete bookmark node')
}

// ノード移動
export const moveBookmarkNode = async (
  id: string,
  params: MoveBookmarkParams
): Promise<BookmarkNode> => {
  const res = await fetchWithAuth(`${API_BASE}/${id}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to move bookmark node')
  return res.json()
}

// 並び順更新
export const reorderBookmarkNodes = async (
  parentId: string | null,
  orderedIds: string[]
): Promise<void> => {
  const res = await fetchWithAuth(`${API_BASE}/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentId, orderedIds }),
  })
  if (!res.ok) throw new Error('Failed to reorder bookmark nodes')
}
