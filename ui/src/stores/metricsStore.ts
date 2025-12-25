/**
 * Performance Metrics Store (v5.14)
 *
 * クライアントサイドでAPIレスポンスのパフォーマンスメトリクスを収集・管理
 * IndexedDBに直近1000件のレコードを保存
 */

// メトリクスレコード型
export type MetricRecord = {
  id: number
  timestamp: number
  action: string
  serverLatency: number
  networkLatency: number
  totalLatency: number
  payloadSize: number
  cached: boolean
}

// 集計結果型
export type MetricsSummary = {
  totalRequests: number
  avgServerLatency: number
  avgNetworkLatency: number
  avgTotalLatency: number
  avgPayloadSize: number
  cacheHitRate: number
  byAction: Record<string, {
    count: number
    avgServerLatency: number
    avgTotalLatency: number
  }>
  recentRequests: MetricRecord[]
}

const DB_NAME = 'brain-cabinet-metrics'
const DB_VERSION = 1
const STORE_NAME = 'metrics'
const MAX_RECORDS = 1000

let db: IDBDatabase | null = null
let dbInitPromise: Promise<IDBDatabase> | null = null

/**
 * IndexedDBを初期化
 */
const initDB = (): Promise<IDBDatabase> => {
  if (db) return Promise.resolve(db)
  if (dbInitPromise) return dbInitPromise

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open metrics DB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('action', 'action', { unique: false })
      }
    }
  })

  return dbInitPromise
}

/**
 * メトリクスを記録
 */
export const recordMetric = async (
  action: string,
  serverLatency: number,
  networkLatency: number,
  payloadSize: number,
  cached: boolean
): Promise<void> => {
  try {
    const database = await initDB()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const record: Omit<MetricRecord, 'id'> = {
      timestamp: Date.now(),
      action,
      serverLatency,
      networkLatency,
      totalLatency: serverLatency + networkLatency,
      payloadSize,
      cached,
    }

    store.add(record)

    // 古いレコードを削除して1000件に制限
    const countRequest = store.count()
    countRequest.onsuccess = () => {
      const count = countRequest.result
      if (count > MAX_RECORDS) {
        const deleteCount = count - MAX_RECORDS
        const cursorRequest = store.index('timestamp').openCursor()
        let deleted = 0

        cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor && deleted < deleteCount) {
            store.delete(cursor.primaryKey)
            deleted++
            cursor.continue()
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to record metric:', error)
  }
}

/**
 * 直近のメトリクスを取得
 */
export const getRecentMetrics = async (limit = 50): Promise<MetricRecord[]> => {
  try {
    const database = await initDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const request = index.openCursor(null, 'prev')

      const records: MetricRecord[] = []

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor && records.length < limit) {
          records.push(cursor.value)
          cursor.continue()
        } else {
          resolve(records)
        }
      }

      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to get recent metrics:', error)
    return []
  }
}

/**
 * 全メトリクスを取得
 */
export const getAllMetrics = async (): Promise<MetricRecord[]> => {
  try {
    const database = await initDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to get all metrics:', error)
    return []
  }
}

/**
 * メトリクスの集計サマリーを取得
 */
export const getMetricsSummary = async (): Promise<MetricsSummary> => {
  const records = await getAllMetrics()
  const recentRecords = await getRecentMetrics(10)

  if (records.length === 0) {
    return {
      totalRequests: 0,
      avgServerLatency: 0,
      avgNetworkLatency: 0,
      avgTotalLatency: 0,
      avgPayloadSize: 0,
      cacheHitRate: 0,
      byAction: {},
      recentRequests: [],
    }
  }

  const totalServerLatency = records.reduce((sum, r) => sum + r.serverLatency, 0)
  const totalNetworkLatency = records.reduce((sum, r) => sum + r.networkLatency, 0)
  const totalLatency = records.reduce((sum, r) => sum + r.totalLatency, 0)
  const totalPayloadSize = records.reduce((sum, r) => sum + r.payloadSize, 0)
  const cacheHits = records.filter(r => r.cached).length

  // アクション別集計
  const byAction: MetricsSummary['byAction'] = {}
  for (const record of records) {
    if (!byAction[record.action]) {
      byAction[record.action] = {
        count: 0,
        avgServerLatency: 0,
        avgTotalLatency: 0,
      }
    }
    byAction[record.action].count++
  }

  // アクション別平均計算
  for (const action of Object.keys(byAction)) {
    const actionRecords = records.filter(r => r.action === action)
    byAction[action].avgServerLatency = actionRecords.reduce((sum, r) => sum + r.serverLatency, 0) / actionRecords.length
    byAction[action].avgTotalLatency = actionRecords.reduce((sum, r) => sum + r.totalLatency, 0) / actionRecords.length
  }

  return {
    totalRequests: records.length,
    avgServerLatency: totalServerLatency / records.length,
    avgNetworkLatency: totalNetworkLatency / records.length,
    avgTotalLatency: totalLatency / records.length,
    avgPayloadSize: totalPayloadSize / records.length,
    cacheHitRate: cacheHits / records.length,
    byAction,
    recentRequests: recentRecords,
  }
}

/**
 * メトリクスをクリア
 */
export const clearMetrics = async (): Promise<void> => {
  try {
    const database = await initDB()
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
  } catch (error) {
    console.error('Failed to clear metrics:', error)
  }
}

// 直近のレイテンシを保持（ステータスバー用）
let lastLatency: { server: number; total: number } | null = null

export const getLastLatency = () => lastLatency

export const setLastLatency = (server: number, total: number) => {
  lastLatency = { server, total }
}
