/**
 * DepthWalk Library 用の型定義
 */

export type LibraryNote = {
  id: string
  title: string
  clusterId: number | null
  category: string | null
  updatedAt: number
  isBookmarked?: boolean
}

export type LibraryCluster = {
  id: number
  label: string | null
  color: string
  position: [number, number, number]
  notes: LibraryNote[]
}

export type LibraryState = {
  clusters: LibraryCluster[]
  selectedNoteId: string | null
  isLoading: boolean
  error: string | null
}
