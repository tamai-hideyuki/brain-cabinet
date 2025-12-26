import { sendCommand } from './commandClient'

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

export const fetchStorageStats = async (): Promise<StorageStats> => {
  return sendCommand<StorageStats>('system.storage')
}
