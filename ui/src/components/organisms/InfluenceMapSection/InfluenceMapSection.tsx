import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import {
  fetchInfluenceSummary,
  type InfluenceSummary,
  type InfluenceSummaryNote,
} from '../../../api/influenceApi'
import './InfluenceMapSection.css'

type InfluenceMapSectionProps = {
  onNoteClick?: (noteId: string) => void
}

const truncateTitle = (title: string, maxLength: number = 20): string => {
  if (title.length <= maxLength) return title
  return title.slice(0, maxLength) + '...'
}

const NoteItem = ({
  note,
  direction,
  onClick,
}: {
  note: InfluenceSummaryNote
  direction: 'influencer' | 'influenced'
  onClick?: (noteId: string) => void
}) => {
  const influencePercent = Math.min(note.totalInfluence * 100, 100)

  return (
    <button
      className="influence-map__note-item"
      onClick={() => onClick?.(note.noteId)}
    >
      <div className="influence-map__note-info">
        <Text variant="body" truncate>
          {truncateTitle(note.title)}
        </Text>
        <div className="influence-map__note-meta">
          <span className="influence-map__edge-count">{note.edgeCount}件</span>
          <span className="influence-map__influence-value">
            {influencePercent.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="influence-map__influence-bar-container">
        <div
          className={`influence-map__influence-bar influence-map__influence-bar--${direction}`}
          style={{ width: `${Math.max(influencePercent, 5)}%` }}
        />
      </div>
    </button>
  )
}

export const InfluenceMapSection = ({ onNoteClick }: InfluenceMapSectionProps) => {
  const [data, setData] = useState<InfluenceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await fetchInfluenceSummary()
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="influence-map influence-map--loading">
        <Spinner size="sm" />
        <Text variant="caption">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="influence-map influence-map--error">
        <Text variant="caption">{error}</Text>
      </div>
    )
  }

  if (!data || data.overview.totalEdges === 0) {
    return (
      <div className="influence-map">
        <div className="influence-map__header">
          <Text variant="subtitle">影響マップ</Text>
        </div>
        <div className="influence-map__empty">
          <Text variant="caption">影響関係がまだありません</Text>
        </div>
      </div>
    )
  }

  return (
    <div className="influence-map">
      <div className="influence-map__header">
        <Text variant="subtitle">影響マップ</Text>
        <Text variant="caption">{data.overview.totalEdges}件の関係</Text>
      </div>

      {/* サマリー統計 */}
      <div className="influence-map__summary">
        <div className="influence-map__stat">
          <Text variant="caption">総エッジ数</Text>
          <Text variant="body">{data.overview.totalEdges}</Text>
        </div>
        <div className="influence-map__stat">
          <Text variant="caption">平均影響度</Text>
          <Text variant="body">{(data.overview.avgWeight * 100).toFixed(1)}%</Text>
        </div>
        <div className="influence-map__stat">
          <Text variant="caption">最大影響度</Text>
          <Text variant="body">{(data.overview.maxWeight * 100).toFixed(1)}%</Text>
        </div>
      </div>

      {/* 2カラムレイアウト */}
      <div className="influence-map__columns">
        {/* 最も影響を与えているノート */}
        <div className="influence-map__column">
          <div className="influence-map__column-header">
            <span className="influence-map__icon">→</span>
            <Text variant="caption">影響を与えるノート</Text>
          </div>
          <div className="influence-map__note-list">
            {data.topInfluencers.slice(0, 3).map((note) => (
              <NoteItem
                key={note.noteId}
                note={note}
                direction="influencer"
                onClick={onNoteClick}
              />
            ))}
          </div>
        </div>

        {/* 最も影響を受けているノート */}
        <div className="influence-map__column">
          <div className="influence-map__column-header">
            <span className="influence-map__icon">←</span>
            <Text variant="caption">影響を受けるノート</Text>
          </div>
          <div className="influence-map__note-list">
            {data.topInfluenced.slice(0, 3).map((note) => (
              <NoteItem
                key={note.noteId}
                note={note}
                direction="influenced"
                onClick={onNoteClick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* インサイト */}
      {data.insight && (
        <div className="influence-map__insight">
          <Text variant="caption">{data.insight}</Text>
        </div>
      )}
    </div>
  )
}
