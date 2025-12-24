import { useState, useEffect } from 'react'
import type { PtmSummary } from '../../types/ptm'
import { fetchPtmSummary } from '../../api/ptmApi'

export const usePTM = () => {
  const [ptm, setPtm] = useState<PtmSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPTM = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPtmSummary()
      setPtm(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPTM()
  }, [])

  return {
    ptm,
    loading,
    error,
    reload: loadPTM,
  }
}
