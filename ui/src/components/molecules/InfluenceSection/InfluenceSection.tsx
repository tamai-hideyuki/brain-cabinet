import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import type { NoteInfluence, InfluenceEdge } from '../../../types/influence'
import './InfluenceSection.css'

type InfluenceSectionProps = {
  influence: NoteInfluence | null
  loading: boolean
  onNoteClick: (noteId: string) => void
}

const InfluenceItem = ({
  edge,
  direction,
  onNoteClick,
}: {
  edge: InfluenceEdge
  direction: 'incoming' | 'outgoing'
  onNoteClick: (noteId: string) => void
}) => {
  const note = direction === 'incoming' ? edge.sourceNote : edge.targetNote
  const noteId = direction === 'incoming' ? edge.sourceNoteId : edge.targetNoteId

  if (!note) return null

  const weightPercent = Math.round(edge.weight * 100)

  return (
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
  )
}

export const InfluenceSection = ({ influence, loading, onNoteClick }: InfluenceSectionProps) => {
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

  const { influencers, influenced, summary } = influence
  const hasInfluence = influencers.length > 0 || influenced.length > 0

  if (!hasInfluence) {
    return (
      <section className="influence-section">
        <Text variant="subtitle">関連ノート</Text>
        <div className="influence-section__empty">
          <Text variant="caption">このノートにはまだ影響関係がありません</Text>
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
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
