/**
 * StatusBar Component (v5.14)
 *
 * APIパフォーマンスメトリクスをリアルタイム表示するミニマルなステータスバー
 */

import { useState, useEffect } from 'react'
import { getLastLatency, getRecentMetrics, type MetricRecord } from '../../../stores/metricsStore'
import './StatusBar.css'

type LatencyStatus = 'good' | 'warning' | 'slow'

const getLatencyStatus = (ms: number): LatencyStatus => {
  if (ms < 100) return 'good'
  if (ms < 300) return 'warning'
  return 'slow'
}

const formatLatency = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export const StatusBar = () => {
  const [lastLatency, setLastLatency] = useState<{ server: number; total: number } | null>(null)
  const [recentMetrics, setRecentMetrics] = useState<MetricRecord[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // 初期読み込み
    const loadMetrics = async () => {
      const metrics = await getRecentMetrics(5)
      setRecentMetrics(metrics)
      const latency = getLastLatency()
      setLastLatency(latency)
    }
    loadMetrics()

    // 定期更新（500msごと）
    const interval = setInterval(() => {
      const latency = getLastLatency()
      setLastLatency(latency)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  // メトリクス更新を監視
  useEffect(() => {
    if (!isExpanded) return

    const loadRecentMetrics = async () => {
      const metrics = await getRecentMetrics(5)
      setRecentMetrics(metrics)
    }

    loadRecentMetrics()
  }, [isExpanded, lastLatency])

  const status = lastLatency ? getLatencyStatus(lastLatency.total) : 'good'

  return (
    <div className={`status-bar ${isExpanded ? 'status-bar--expanded' : ''}`}>
      <button
        className="status-bar__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? '詳細を閉じる' : '詳細を表示'}
      >
        <span className={`status-bar__indicator status-bar__indicator--${status}`} />
        {lastLatency ? (
          <span className="status-bar__latency">
            <span className="status-bar__label">Server:</span>
            <span className={`status-bar__value status-bar__value--${getLatencyStatus(lastLatency.server)}`}>
              {formatLatency(lastLatency.server)}
            </span>
            <span className="status-bar__separator">|</span>
            <span className="status-bar__label">Total:</span>
            <span className={`status-bar__value status-bar__value--${status}`}>
              {formatLatency(lastLatency.total)}
            </span>
          </span>
        ) : (
          <span className="status-bar__latency">
            <span className="status-bar__label">待機中...</span>
          </span>
        )}
        <svg
          className={`status-bar__chevron ${isExpanded ? 'status-bar__chevron--up' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isExpanded && (
        <div className="status-bar__details">
          <div className="status-bar__details-header">
            <span>直近のリクエスト</span>
            <a href="/ui/system#metrics" className="status-bar__details-link">
              詳細を見る
            </a>
          </div>
          {recentMetrics.length > 0 ? (
            <ul className="status-bar__metrics-list">
              {recentMetrics.map((metric) => (
                <li key={metric.id} className="status-bar__metrics-item">
                  <span className="status-bar__metrics-action">{metric.action}</span>
                  <span className="status-bar__metrics-values">
                    <span className={`status-bar__value status-bar__value--${getLatencyStatus(metric.serverLatency)}`}>
                      {formatLatency(metric.serverLatency)}
                    </span>
                    <span className="status-bar__separator">/</span>
                    <span className={`status-bar__value status-bar__value--${getLatencyStatus(metric.totalLatency)}`}>
                      {formatLatency(metric.totalLatency)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status-bar__no-data">まだリクエストがありません</p>
          )}
        </div>
      )}
    </div>
  )
}
