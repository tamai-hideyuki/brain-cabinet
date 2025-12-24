import { useState, useEffect, useCallback } from 'react'
import type { PromotionCandidate } from '../../types/note'
import { fetchPromotionCandidates } from '../../api/notesApi'

export const usePromotionCandidates = () => {
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPromotionCandidates(10)
      setCandidates(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Helper to check if a note is a promotion candidate
  const isPromotionCandidate = useCallback(
    (noteId: string): PromotionCandidate | undefined => {
      return candidates.find((c) => c.noteId === noteId)
    },
    [candidates]
  )

  // Get candidate noteIds as a Set for fast lookup
  const candidateIds = new Set(candidates.map((c) => c.noteId))

  return {
    candidates,
    candidateIds,
    loading,
    error,
    reload: load,
    isPromotionCandidate,
  }
}
