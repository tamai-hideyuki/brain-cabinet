import { useState, useEffect, useCallback } from 'react'
import * as isolationAdapter from '../../adapters/isolationAdapter'
import type { IsolatedNote, IsolationStats, IntegrationSuggestion } from '../../adapters/isolationAdapter'

export const useIsolation = (initialThreshold = 0.7) => {
  const [notes, setNotes] = useState<IsolatedNote[]>([])
  const [stats, setStats] = useState<IsolationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(initialThreshold)
  const [selectedNote, setSelectedNote] = useState<IsolatedNote | null>(null)
  const [suggestions, setSuggestions] = useState<IntegrationSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [notesData, statsData] = await Promise.all([
        isolationAdapter.getIsolatedNotes(threshold, 50),
        isolationAdapter.getStats(threshold),
      ])
      setNotes(notesData)
      setStats(statsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [threshold])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadSuggestions = useCallback(async (noteId: string) => {
    setSuggestionsLoading(true)
    try {
      const data = await isolationAdapter.getSuggestions(noteId, 5)
      setSuggestions(data)
    } catch (e) {
      console.error('Failed to load suggestions:', e)
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }, [])

  const selectNote = useCallback((note: IsolatedNote) => {
    setSelectedNote(note)
    loadSuggestions(note.noteId)
  }, [loadSuggestions])

  const clearSelection = useCallback(() => {
    setSelectedNote(null)
    setSuggestions([])
  }, [])

  const updateThreshold = useCallback((newThreshold: number) => {
    setThreshold(newThreshold)
    setSelectedNote(null)
    setSuggestions([])
  }, [])

  return {
    notes,
    stats,
    loading,
    error,
    threshold,
    selectedNote,
    suggestions,
    suggestionsLoading,
    reload: loadData,
    selectNote,
    clearSelection,
    updateThreshold,
  }
}
