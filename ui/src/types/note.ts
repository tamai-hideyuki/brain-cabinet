export type NoteType = 'decision' | 'learning' | 'scratch' | 'emotion' | 'log'

export type Note = {
  id: string
  title: string
  content: string
  path: string | null
  tags: string[]
  category: string | null
  clusterId: number | null
  createdAt: number
  updatedAt: number
}

export type NoteListResponse = {
  notes: Note[]
  total: number
}

export type SearchMode = 'keyword' | 'semantic' | 'hybrid'
