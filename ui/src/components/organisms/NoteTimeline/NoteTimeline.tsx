import { useState, useEffect, useMemo } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import { Button } from '../../atoms/Button'
import { fetchNotes } from '../../../api/notesApi'
import { getPomodoroHistory, type PomodoroHistory } from '../../../hooks/usePomodoroTimer'
import type { Note } from '../../../types/note'
import './NoteTimeline.css'

type ViewMode = 'timeline' | 'calendar'

const PAGE_SIZE = 30

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const formatDateLabel = (dateStr: string): string => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (dateStr === todayStr) {
    return '今日'
  }
  if (dateStr === yesterdayStr) {
    return '昨日'
  }

  // dateStr は YYYY-MM-DD 形式なのでパースして表示
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
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

// Date オブジェクトをローカルタイムゾーンで YYYY-MM-DD に変換
const toLocalDateStr = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
  const [allNotesLoaded, setAllNotesLoaded] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // ページネーション用state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalNotes, setTotalNotes] = useState(0)

  const totalPages = Math.ceil(totalNotes / PAGE_SIZE)

  // タイムラインモード: ページネーション対応
  // カレンダーモード: 全件取得
  useEffect(() => {
    const loadNotes = async () => {
      try {
        setLoading(true)
        if (viewMode === 'calendar' && !allNotesLoaded) {
          // カレンダーモードでは全件取得（limit: 0）
          const result = await fetchNotes({ limit: 0 })
          setNotes(result.notes)
          setTotalNotes(result.total)
          setAllNotesLoaded(true)
        } else if (viewMode === 'timeline') {
          // タイムラインモードでは30件ずつページネーション
          const offset = (currentPage - 1) * PAGE_SIZE
          const result = await fetchNotes({ limit: PAGE_SIZE, offset })
          setNotes(result.notes)
          setTotalNotes(result.total)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadNotes()
  }, [viewMode, allNotesLoaded, currentPage])

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

  // ポモドーロセッション履歴
  const [pomodoroHistory, setPomodoroHistory] = useState<PomodoroHistory>({})

  // カレンダーモードでポモドーロ履歴を取得
  useEffect(() => {
    if (viewMode === 'calendar') {
      getPomodoroHistory().then(setPomodoroHistory)
    }
  }, [viewMode])

  // 選択された日付のノート一覧
  const selectedDateNotes = useMemo((): Note[] => {
    if (!selectedDate) return []
    return notes
      .filter((note) => formatDate(note.updatedAt) === selectedDate)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, selectedDate])

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
        <Text variant="caption">
          {viewMode === 'timeline' && totalNotes > PAGE_SIZE
            ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalNotes)} / ${totalNotes} ノート`
            : `${notes.length} ノート`}
        </Text>
      </div>

      {viewMode === 'timeline' ? (
        <>
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

        {/* ページネーション（2ページ以上ある場合のみ表示） */}
        {totalPages > 1 && (
          <div className="note-timeline__pagination">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              ⏮ 最初
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← 前へ
            </Button>
            <Text variant="body">
              {currentPage} / {totalPages} ページ
            </Text>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              次へ →
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              最後 ⏭
            </Button>
          </div>
        )}
        </>
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
              const dateStr = toLocalDateStr(day)
              const count = noteCountByDate.get(dateStr) || 0
              const pomodoroCount = pomodoroHistory[dateStr] || 0
              const isToday = dateStr === toLocalDateStr(new Date())
              const hasContent = count > 0 || pomodoroCount > 0

              return (
                <button
                  key={dateStr}
                  className={`note-timeline__calendar-day ${isToday ? 'note-timeline__calendar-day--today' : ''} ${count > 0 ? 'note-timeline__calendar-day--has-notes' : ''} ${selectedDate === dateStr ? 'note-timeline__calendar-day--selected' : ''}`}
                  title={hasContent ? `${count}件のノート / ${pomodoroCount}ポモドーロ` : undefined}
                  onClick={() => count > 0 && setSelectedDate(selectedDate === dateStr ? null : dateStr)}
                  disabled={count === 0}
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
                  {pomodoroCount > 0 && (
                    <span className="note-timeline__calendar-day-pomodoro">
                      {pomodoroCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          {selectedDate && selectedDateNotes.length > 0 && (
            <div className="note-timeline__calendar-selected">
              <div className="note-timeline__calendar-selected-header">
                <div className="note-timeline__calendar-selected-title">
                  <Text variant="subtitle">{formatDateLabel(selectedDate)}</Text>
                  <Text variant="caption">{selectedDateNotes.length}件のノート</Text>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setSelectedDate(null)}>
                  閉じる
                </Button>
              </div>
              <div className="note-timeline__calendar-selected-notes">
                {selectedDateNotes.map((note) => (
                  <button
                    key={note.id}
                    className="note-timeline__note note-timeline__note--row"
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
          )}
        </div>
      )}
    </div>
  )
}
