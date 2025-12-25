import { fetchWithAuth } from './client'

export type TableInfo = {
  name: string
  label: string
  rowCount: number
  size: number
}

export type StorageStats = {
  totalSize: number
  tables: TableInfo[]
}

const API_BASE = '/api'

export const fetchStorageStats = async (): Promise<StorageStats> => {
  const res = await fetchWithAuth(`${API_BASE}/system/storage`)
  if (!res.ok) throw new Error('Failed to fetch storage stats')
  return res.json()
}
