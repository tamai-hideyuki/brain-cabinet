import { useState, useEffect, useMemo } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import { Button } from '../../atoms/Button'
import { fetchNotes } from '../../../api/notesApi'
import type { Note } from '../../../types/note'
import './NoteTimeline.css'

type ViewMode = 'timeline' | 'calendar'

type NoteTimelineProps = {
  onNoteClick?: (noteId: string) => void
}

type DayGroup = {
  date: string
  dateLabel: string
  notes: Note[]
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.toISOString().split('T')[0]
}

const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split('T')[0]) {
    return '今日'
  }
  if (dateStr === yesterday.toISOString().split('T')[0]) {
    return '昨日'
  }

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

const getCategoryBadgeVariant = (category: string | null): 'decision' | 'learning' | 'default' => {
  if (category === '判断' || category === 'decision') return 'decision'
  if (category === '学習' || category === 'learning') return 'learning'
  return 'default'
}

// カレンダー用のヘルパー
const getDaysInMonth = (year: number, month: number): Date[] => {
  const days: Date[] = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

const getMonthStartPadding = (year: number, month: number): number => {
  const firstDay = new Date(year, month, 1).getDay()
  return firstDay === 0 ? 6 : firstDay - 1 // 月曜始まり
}

export const NoteTimeline = ({ onNoteClick }: NoteTimelineProps) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const data = await fetchNotes()
        setNotes(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadNotes()
  }, [])

  // 日付でグループ化（タイムライン用）
  const groupedByDate = useMemo((): DayGroup[] => {
    const groups: Map<string, Note[]> = new Map()

    notes.forEach((note) => {
      const dateStr = formatDate(note.updatedAt)
      const existing = groups.get(dateStr) || []
      existing.push(note)
      groups.set(dateStr, existing)
    })

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, notes]) => ({
        date,
        dateLabel: formatDateLabel(date),
        notes: notes.sort((a, b) => b.updatedAt - a.updatedAt),
      }))
  }, [notes])

  // カレンダー用の日付→ノート数マップ
  const noteCountByDate = useMemo((): Map<string, number> => {
    const counts = new Map<string, number>()
    notes.forEach((note) => {
      const dateStr = formatDate(note.updatedAt)
      counts.set(dateStr, (counts.get(dateStr) || 0) + 1)
    })
    return counts
  }, [notes])

  const handlePrevMonth = () => {
    setSelectedMonth((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 }
      }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  const handleNextMonth = () => {
    setSelectedMonth((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 }
      }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  if (loading) {
    return (
      <div className="note-timeline__loading">
        <Spinner size="lg" />
        <Text variant="body">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="note-timeline__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  const days = getDaysInMonth(selectedMonth.year, selectedMonth.month)
  const startPadding = getMonthStartPadding(selectedMonth.year, selectedMonth.month)

  return (
    <div className="note-timeline">
      <div className="note-timeline__header">
        <div className="note-timeline__view-toggle">
          <Button
            variant={viewMode === 'timeline' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('timeline')}
          >
            タイムライン
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('calendar')}
          >
            カレンダー
          </Button>
        </div>
        <Text variant="caption">{notes.length} ノート</Text>
      </div>

      {viewMode === 'timeline' ? (
        <div className="note-timeline__list">
          {groupedByDate.map((group) => (
            <div key={group.date} className="note-timeline__day">
              <div className="note-timeline__day-header">
                <div className="note-timeline__day-marker" />
                <Text variant="subtitle">{group.dateLabel}</Text>
                <Text variant="caption">{group.notes.length}件</Text>
              </div>
              <div className="note-timeline__day-notes">
                {group.notes.map((note) => (
                  <button
                    key={note.id}
                    className="note-timeline__note"
                    onClick={() => onNoteClick?.(note.id)}
                  >
                    <Text variant="body" truncate>
                      {note.title}
                    </Text>
                    <div className="note-timeline__note-meta">
                      {note.category && (
                        <Badge variant={getCategoryBadgeVariant(note.category)}>
                          {note.category}
                        </Badge>
                      )}
                      <Text variant="caption">
                        {new Date(note.updatedAt * 1000).toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="note-timeline__calendar">
          <div className="note-timeline__calendar-nav">
            <Button variant="secondary" size="sm" onClick={handlePrevMonth}>
              ←
            </Button>
            <Text variant="subtitle">
              {selectedMonth.year}年{selectedMonth.month + 1}月
            </Text>
            <Button variant="secondary" size="sm" onClick={handleNextMonth}>
              →
            </Button>
          </div>
          <div className="note-timeline__calendar-header">
            {['月', '火', '水', '木', '金', '土', '日'].map((day) => (
              <div key={day} className="note-timeline__calendar-weekday">
                {day}
              </div>
            ))}
          </div>
          <div className="note-timeline__calendar-grid">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="note-timeline__calendar-day--empty" />
            ))}
            {days.map((day) => {
              const dateStr = day.toISOString().split('T')[0]
              const count = noteCountByDate.get(dateStr) || 0
              const isToday = dateStr === new Date().toISOString().split('T')[0]

              return (
                <div
                  key={dateStr}
                  className={`note-timeline__calendar-day ${isToday ? 'note-timeline__calendar-day--today' : ''} ${count > 0 ? 'note-timeline__calendar-day--has-notes' : ''}`}
                  title={count > 0 ? `${count}件のノート` : undefined}
                >
                  <span className="note-timeline__calendar-day-num">{day.getDate()}</span>
                  {count > 0 && (
                    <span
                      className="note-timeline__calendar-day-count"
                      style={{
                        opacity: Math.min(0.3 + count * 0.15, 1),
                      }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
