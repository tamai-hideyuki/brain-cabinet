import { useState, useEffect, useMemo, useCallback } from 'react'
import * as timelineAdapter from '../../adapters/timelineAdapter'
import { buildCalendarHierarchy, type CalendarNote, type CalendarHierarchy } from '../../utils/calendarHierarchy'

export const useTimelineNotes = () => {
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const calendarNotes = await timelineAdapter.getCalendarNotes()
      setNotes(calendarNotes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // ノートをカレンダー階層に変換
  const hierarchy: CalendarHierarchy = useMemo(() => buildCalendarHierarchy(notes), [notes])

  const selectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedNoteId(null)
  }, [])

  return {
    notes,
    hierarchy,
    loading,
    error,
    selectedNoteId,
    reload: loadNotes,
    selectNote,
    clearSelection,
  }
}
