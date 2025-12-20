export type BookmarkNodeType = 'folder' | 'note' | 'link'

export type BookmarkNode = {
  id: string
  parentId: string | null
  type: BookmarkNodeType
  name: string
  noteId: string | null
  url: string | null
  position: number
  isExpanded: boolean
  createdAt: number
  updatedAt: number
  note?: {
    id: string
    title: string
    category: string | null
  } | null
  children?: BookmarkNode[]
}

export type CreateBookmarkParams = {
  parentId?: string | null
  type: BookmarkNodeType
  name: string
  noteId?: string | null
  url?: string | null
}

export type UpdateBookmarkParams = {
  name?: string
  isExpanded?: boolean
}

export type MoveBookmarkParams = {
  parentId: string | null
  position?: number
}
