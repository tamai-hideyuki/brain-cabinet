import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import type { NoteInfluence, InfluenceEdge, SimilarNote } from '../../../types/influence'
import './InfluenceSection.css'

type InfluenceSectionProps = {
  influence: NoteInfluence | null
  loading: boolean
  onNoteClick: (noteId: string) => void
  onAddLink?: (noteId: string, noteTitle: string) => void
  addingLinkNoteId?: string | null
}

const InfluenceItem = ({
  edge,
  direction,
  onNoteClick,
  onAddLink,
  isAddingLink,
}: {
  edge: InfluenceEdge
  direction: 'incoming' | 'outgoing'
  onNoteClick: (noteId: string) => void
  onAddLink?: (noteId: string, noteTitle: string) => void
  isAddingLink?: boolean
}) => {
  const note = direction === 'incoming' ? edge.sourceNote : edge.targetNote
  const noteId = direction === 'incoming' ? edge.sourceNoteId : edge.targetNoteId

  if (!note) return null

  const weightPercent = Math.round(edge.weight * 100)

  const handleAddLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddLink) {
      onAddLink(noteId, note.title)
    }
  }

  return (
    <div className="influence-item-wrapper">
      <button className="influence-item" onClick={() => onNoteClick(noteId)}>
        <div className="influence-item__content">
          <Text variant="body" truncate>
            {note.title}
          </Text>
          <div className="influence-item__meta">
            {note.clusterId !== null && (
              <Badge variant="default">C{note.clusterId}</Badge>
            )}
            <span className="influence-item__weight" title={`影響度: ${edge.weight.toFixed(3)}`}>
              {weightPercent}%
            </span>
          </div>
        </div>
        <div className="influence-item__bar">
          <div
            className="influence-item__bar-fill"
            style={{ width: `${Math.min(weightPercent, 100)}%` }}
          />
        </div>
      </button>
      {onAddLink && (
        <button
          className="influence-item__add-link"
          onClick={handleAddLink}
          disabled={isAddingLink}
          title="このノートへのリンクを末尾に追加"
        >
          {isAddingLink ? '...' : '+'}
        </button>
      )}
    </div>
  )
}

const SimilarNoteItem = ({
  similarNote,
  onNoteClick,
  onAddLink,
  isAddingLink,
}: {
  similarNote: SimilarNote
  onNoteClick: (noteId: string) => void
  onAddLink?: (noteId: string, noteTitle: string) => void
  isAddingLink?: boolean
}) => {
  if (!similarNote.note) return null

  const similarityPercent = Math.round(similarNote.similarity * 100)

  const handleAddLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onAddLink && similarNote.note) {
      onAddLink(similarNote.noteId, similarNote.note.title)
    }
  }

  return (
    <div className="influence-item-wrapper">
      <button className="influence-item" onClick={() => onNoteClick(similarNote.noteId)}>
        <div className="influence-item__content">
          <Text variant="body" truncate>
            {similarNote.note.title}
          </Text>
          <div className="influence-item__meta">
            {similarNote.note.clusterId !== null && (
              <Badge variant="default">C{similarNote.note.clusterId}</Badge>
            )}
            <span className="influence-item__weight" title={`類似度: ${similarNote.similarity.toFixed(3)}`}>
              {similarityPercent}%
            </span>
          </div>
        </div>
        <div className="influence-item__bar">
          <div
            className="influence-item__bar-fill influence-item__bar-fill--similar"
            style={{ width: `${Math.min(similarityPercent, 100)}%` }}
          />
        </div>
      </button>
      {onAddLink && (
        <button
          className="influence-item__add-link"
          onClick={handleAddLink}
          disabled={isAddingLink}
          title="このノートへのリンクを末尾に追加"
        >
          {isAddingLink ? '...' : '+'}
        </button>
      )}
    </div>
  )
}

export const InfluenceSection = ({ influence, loading, onNoteClick, onAddLink, addingLinkNoteId }: InfluenceSectionProps) => {
  if (loading) {
    return (
      <section className="influence-section">
        <div className="influence-section__loading">
          <Spinner size="sm" />
          <Text variant="caption">影響関係を読み込み中...</Text>
        </div>
      </section>
    )
  }

  if (!influence) {
    return null
  }

  const { influencers, influenced, summary, similarNotes } = influence
  const hasInfluence = influencers.length > 0 || influenced.length > 0
  const hasSimilarNotes = similarNotes && similarNotes.length > 0

  // 影響関係も類似ノートもない場合
  if (!hasInfluence && !hasSimilarNotes) {
    return (
      <section className="influence-section">
        <Text variant="subtitle">関連ノート</Text>
        <div className="influence-section__empty">
          <Text variant="caption">このノートにはまだ影響関係がありません</Text>
        </div>
      </section>
    )
  }

  // 影響関係がなく、類似ノートがある場合
  if (!hasInfluence && hasSimilarNotes) {
    return (
      <section className="influence-section">
        <div className="influence-section__header">
          <Text variant="subtitle">類似ノート</Text>
          <Text variant="caption">（Embeddingベース）</Text>
        </div>
        <div className="influence-section__list">
          {similarNotes.map((sn) => (
            <SimilarNoteItem
              key={sn.noteId}
              similarNote={sn}
              onNoteClick={onNoteClick}
              onAddLink={onAddLink}
              isAddingLink={addingLinkNoteId === sn.noteId}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="influence-section">
      <div className="influence-section__header">
        <Text variant="subtitle">関連ノート</Text>
        <div className="influence-section__summary">
          <span className="influence-section__stat">
            <span className="influence-section__stat-icon">←</span>
            {summary.incomingEdges}
          </span>
          <span className="influence-section__stat">
            <span className="influence-section__stat-icon">→</span>
            {summary.outgoingEdges}
          </span>
        </div>
      </div>

      <div className="influence-section__columns">
        {influencers.length > 0 && (
          <div className="influence-section__column">
            <div className="influence-section__column-header">
              <Text variant="caption">このノートに影響を与えた</Text>
            </div>
            <div className="influence-section__list">
              {influencers.map((edge) => (
                <InfluenceItem
                  key={edge.sourceNoteId}
                  edge={edge}
                  direction="incoming"
                  onNoteClick={onNoteClick}
                  onAddLink={onAddLink}
                  isAddingLink={addingLinkNoteId === edge.sourceNoteId}
                />
              ))}
            </div>
          </div>
        )}

        {influenced.length > 0 && (
          <div className="influence-section__column">
            <div className="influence-section__column-header">
              <Text variant="caption">このノートが影響を与えた</Text>
            </div>
            <div className="influence-section__list">
              {influenced.map((edge) => (
                <InfluenceItem
                  key={edge.targetNoteId}
                  edge={edge}
                  direction="outgoing"
                  onNoteClick={onNoteClick}
                  onAddLink={onAddLink}
                  isAddingLink={addingLinkNoteId === edge.targetNoteId}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
