import type {
  BookmarkNode,
  CreateBookmarkParams,
  UpdateBookmarkParams,
  MoveBookmarkParams,
} from '../types/bookmark'
import { sendCommand } from './commandClient'

// ブックマークツリー取得
export const fetchBookmarkTree = async (): Promise<BookmarkNode[]> => {
  return sendCommand<BookmarkNode[]>('bookmark.list')
}

// 単一ノード取得
export const fetchBookmarkNode = async (id: string): Promise<BookmarkNode> => {
  return sendCommand<BookmarkNode>('bookmark.get', { id })
}

// ノード作成
export const createBookmarkNode = async (
  params: CreateBookmarkParams
): Promise<BookmarkNode> => {
  return sendCommand<BookmarkNode>('bookmark.create', params)
}

// ノード更新
export const updateBookmarkNode = async (
  id: string,
  params: UpdateBookmarkParams
): Promise<BookmarkNode> => {
  return sendCommand<BookmarkNode>('bookmark.update', { id, ...params })
}

// ノード削除
export const deleteBookmarkNode = async (id: string): Promise<void> => {
  await sendCommand<void>('bookmark.delete', { id })
}

// ノード移動
export const moveBookmarkNode = async (
  id: string,
  params: MoveBookmarkParams
): Promise<BookmarkNode> => {
  return sendCommand<BookmarkNode>('bookmark.move', { id, ...params })
}

// 並び順更新
export const reorderBookmarkNodes = async (
  parentId: string | null,
  orderedIds: string[]
): Promise<void> => {
  await sendCommand<void>('bookmark.reorder', { parentId, orderedIds })
}
