import type { PtmSummary } from '../types/ptm'
import { fetchWithAuth } from './client'

const API_BASE = '/api'

export const fetchPtmSummary = async (): Promise<PtmSummary> => {
  const res = await fetchWithAuth(`${API_BASE}/ptm/summary`)
  if (!res.ok) throw new Error('Failed to fetch PTM summary')
  return res.json()
}
