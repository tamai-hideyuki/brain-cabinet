import { NoteCard } from '../../molecules/NoteCard'
import { Spinner } from '../../atoms/Spinner'
import { Text } from '../../atoms/Text'
import type { Note, PromotionCandidate } from '../../../types/note'
import './NoteList.css'

type NoteListProps = {
  notes: Note[]
  loading: boolean
  error: string | null
  onNoteClick: (id: string) => void
  promotionCandidates?: PromotionCandidate[]
}

export const NoteList = ({ notes, loading, error, onNoteClick, promotionCandidates = [] }: NoteListProps) => {
  // Create a map for fast lookup of promotion candidates by noteId
  const candidateMap = new Map(promotionCandidates.map((c) => [c.noteId, c]))
  if (loading) {
    return (
      <div className="note-list__loading">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="note-list__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="note-list__empty">
        <Text variant="body">ノートが見つかりませんでした</Text>
      </div>
    )
  }

  return (
    <div className="note-list">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onClick={() => onNoteClick(note.id)}
          promotionCandidate={candidateMap.get(note.id)}
        />
      ))}
    </div>
  )
}
