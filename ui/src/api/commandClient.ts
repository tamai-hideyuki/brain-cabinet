/**
 * Command API Client (v5.14)
 *
 * /api/v1 エンドポイント用の共通クライアント
 * パフォーマンスメトリクス収集機能付き
 */

import { fetchWithAuth } from './client'
import { recordMetric, setLastLatency } from '../stores/metricsStore'
import { notifyDataChange, isMutatingAction } from '../stores/dataChangeStore'

const API_BASE = '/api/v1'

type BcMeta = {
  serverLatency: number
  cached: boolean
  action: string
}

type CommandResponse<T> = {
  success: boolean
  action: string
  result: T
  _bcMeta?: BcMeta
}

/**
 * コマンドを送信し、結果を返す
 * _bcMetaが含まれている場合はメトリクスを自動記録
 */
export async function sendCommand<T>(
  action: string,
  payload?: Record<string, unknown>
): Promise<T> {
  const startTime = performance.now()

  const res = await fetchWithAuth(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  })

  const endTime = performance.now()
  const totalLatency = endTime - startTime

  if (!res.ok) throw new Error(`Failed to execute ${action}`)

  const text = await res.text()
  const payloadSize = new TextEncoder().encode(text).length
  const data: CommandResponse<T> = JSON.parse(text)

  if (!data.success) throw new Error(`Command ${action} failed`)

  // メトリクス記録（v5.14）
  if (data._bcMeta) {
    const networkLatency = totalLatency - data._bcMeta.serverLatency
    recordMetric(
      data._bcMeta.action,
      data._bcMeta.serverLatency,
      networkLatency,
      payloadSize,
      data._bcMeta.cached
    )
    setLastLatency(data._bcMeta.serverLatency, totalLatency)
  }

  // データ変更イベントを発行
  if (isMutatingAction(action)) {
    notifyDataChange()
  }

  return data.result
}
