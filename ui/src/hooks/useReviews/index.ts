import { useState, useEffect } from 'react'
import type { ReviewListResponse } from '../../types/review'
import { fetchReviewList } from '../../api/reviewApi'

export const useReviews = () => {
  const [data, setData] = useState<ReviewListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchReviewList()
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return { data, loading, error, reload: load }
}
