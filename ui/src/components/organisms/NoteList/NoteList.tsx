import { NoteCard } from '../../molecules/NoteCard'
import { Spinner } from '../../atoms/Spinner'
import { Text } from '../../atoms/Text'
import type { Note } from '../../../types/note'
import './NoteList.css'

type NoteListProps = {
  notes: Note[]
  loading: boolean
  error: string | null
  onNoteClick: (id: string) => void
}

export const NoteList = ({ notes, loading, error, onNoteClick }: NoteListProps) => {
  if (loading) {
    return (
      <div class="note-list__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div class="note-list__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div class="note-list__empty">
        <Text variant="body">ノートが見つかりませんでした</Text>
      </div>
    )
  }

  return (
    <div class="note-list">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onClick={() => onNoteClick(note.id)}
        />
      ))}
    </div>
  )
}
