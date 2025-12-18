import type { PtmSummary } from '../types/ptm'

const API_BASE = '/api'

export const fetchPtmSummary = async (): Promise<PtmSummary> => {
  const res = await fetch(`${API_BASE}/ptm/summary`)
  if (!res.ok) throw new Error('Failed to fetch PTM summary')
  return res.json()
}
