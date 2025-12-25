import { useState, useEffect } from 'react'
import { MainLayout } from '../../templates/MainLayout'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import { fetchStorageStats, type StorageStats, type TableInfo } from '../../../api/systemApi'
import {
  getMetricsSummary,
  clearMetrics,
  type MetricsSummary,
} from '../../../stores/metricsStore'
import './SystemPage.css'

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`
}

const formatNumber = (n: number): string => {
  return n.toLocaleString('ja-JP')
}

const formatLatency = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export const SystemPage = () => {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [storageData, metricsData] = await Promise.all([
          fetchStorageStats(),
          getMetricsSummary(),
        ])
        setStats(storageData)
        setMetrics(metricsData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'データ取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleClearMetrics = async () => {
    await clearMetrics()
    const metricsData = await getMetricsSummary()
    setMetrics(metricsData)
  }

  const calculatePercentage = (size: number): number => {
    if (!stats || stats.totalSize === 0) return 0
    return (size / stats.totalSize) * 100
  }

  const renderTableRow = (table: TableInfo) => {
    const percentage = calculatePercentage(table.size)
    return (
      <tr key={table.name} className="system-page__table-row">
        <td className="system-page__table-cell system-page__table-cell--name">
          <span className="system-page__table-label">{table.label}</span>
          <span className="system-page__table-name">{table.name}</span>
        </td>
        <td className="system-page__table-cell system-page__table-cell--count">
          {formatNumber(table.rowCount)}
        </td>
        <td className="system-page__table-cell system-page__table-cell--size">
          {formatBytes(table.size)}
        </td>
        <td className="system-page__table-cell system-page__table-cell--bar">
          <div className="system-page__bar-container">
            <div
              className="system-page__bar"
              style={{ width: `${Math.max(percentage, 0.5)}%` }}
            />
            <span className="system-page__bar-label">
              {percentage > 0.1 ? `${percentage.toFixed(1)}%` : '<0.1%'}
            </span>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <MainLayout>
      <div className="system-page">
        <div className="system-page__header">
          <Text variant="title">システム情報</Text>
        </div>

        {loading && (
          <div className="system-page__loading">
            <Spinner />
            <Text variant="body">読み込み中...</Text>
          </div>
        )}

        {error && (
          <div className="system-page__error">
            <Text variant="body">{error}</Text>
          </div>
        )}

        {stats && !loading && (
          <>
            <div className="system-page__summary">
              <div className="system-page__summary-card">
                <Text variant="caption">データベース容量</Text>
                <Text variant="title">{formatBytes(stats.totalSize)}</Text>
              </div>
              <div className="system-page__summary-card">
                <Text variant="caption">テーブル数</Text>
                <Text variant="title">{stats.tables.length}</Text>
              </div>
              <div className="system-page__summary-card">
                <Text variant="caption">総レコード数</Text>
                <Text variant="title">
                  {formatNumber(stats.tables.reduce((sum, t) => sum + t.rowCount, 0))}
                </Text>
              </div>
            </div>

            <div className="system-page__section">
              <Text variant="subtitle">テーブル別内訳</Text>
              <div className="system-page__table-wrapper">
                <table className="system-page__table">
                  <thead>
                    <tr>
                      <th className="system-page__table-header">テーブル</th>
                      <th className="system-page__table-header system-page__table-header--right">レコード数</th>
                      <th className="system-page__table-header system-page__table-header--right">サイズ</th>
                      <th className="system-page__table-header">割合</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.tables
                      .filter(t => t.rowCount > 0 || t.size > 0)
                      .map(renderTableRow)}
                  </tbody>
                </table>
              </div>
              {stats.tables.filter(t => t.rowCount === 0 && t.size === 0).length > 0 && (
                <div className="system-page__empty-tables">
                  <Text variant="caption">
                    空のテーブル: {stats.tables.filter(t => t.rowCount === 0).map(t => t.label).join('、')}
                  </Text>
                </div>
              )}
            </div>
          </>
        )}

        {/* パフォーマンスメトリクス（v5.14） */}
        <div className="system-page__section" id="metrics">
          <div className="system-page__section-header">
            <Text variant="subtitle">パフォーマンスメトリクス</Text>
            {metrics && metrics.totalRequests > 0 && (
              <button
                className="system-page__clear-btn"
                onClick={handleClearMetrics}
              >
                クリア
              </button>
            )}
          </div>

          {metrics && metrics.totalRequests > 0 ? (
            <>
              <div className="system-page__summary">
                <div className="system-page__summary-card">
                  <Text variant="caption">総リクエスト数</Text>
                  <Text variant="title">{formatNumber(metrics.totalRequests)}</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均サーバー処理時間</Text>
                  <Text variant="title">{formatLatency(metrics.avgServerLatency)}</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均ネットワーク時間</Text>
                  <Text variant="title">{formatLatency(metrics.avgNetworkLatency)}</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均トータル時間</Text>
                  <Text variant="title">{formatLatency(metrics.avgTotalLatency)}</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均ペイロードサイズ</Text>
                  <Text variant="title">{formatBytes(metrics.avgPayloadSize)}</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">キャッシュヒット率</Text>
                  <Text variant="title">{(metrics.cacheHitRate * 100).toFixed(1)}%</Text>
                </div>
              </div>

              <div className="system-page__metrics-section">
                <span className="system-page__metrics-label">アクション別統計</span>
                <div className="system-page__table-wrapper">
                  <table className="system-page__table">
                    <thead>
                      <tr>
                        <th className="system-page__table-header">アクション</th>
                        <th className="system-page__table-header system-page__table-header--right">回数</th>
                        <th className="system-page__table-header system-page__table-header--right">平均サーバー</th>
                        <th className="system-page__table-header system-page__table-header--right">平均トータル</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(metrics.byAction)
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([action, data]) => (
                          <tr key={action} className="system-page__table-row">
                            <td className="system-page__table-cell">
                              <code className="system-page__action-name">{action}</code>
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--count">
                              {formatNumber(data.count)}
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--size">
                              {formatLatency(data.avgServerLatency)}
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--size">
                              {formatLatency(data.avgTotalLatency)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {metrics.recentRequests.length > 0 && (
                <div className="system-page__metrics-section">
                  <span className="system-page__metrics-label">直近のリクエスト</span>
                  <div className="system-page__table-wrapper">
                    <table className="system-page__table">
                      <thead>
                        <tr>
                          <th className="system-page__table-header">アクション</th>
                          <th className="system-page__table-header system-page__table-header--right">サーバー</th>
                          <th className="system-page__table-header system-page__table-header--right">ネットワーク</th>
                          <th className="system-page__table-header system-page__table-header--right">トータル</th>
                          <th className="system-page__table-header system-page__table-header--right">サイズ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.recentRequests.map((req) => (
                          <tr key={req.id} className="system-page__table-row">
                            <td className="system-page__table-cell">
                              <code className="system-page__action-name">{req.action}</code>
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--size">
                              {formatLatency(req.serverLatency)}
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--size">
                              {formatLatency(req.networkLatency)}
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--size">
                              {formatLatency(req.totalLatency)}
                            </td>
                            <td className="system-page__table-cell system-page__table-cell--size">
                              {formatBytes(req.payloadSize)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="system-page__empty-metrics">
              <Text variant="body">まだメトリクスがありません。APIリクエストを実行するとデータが収集されます。</Text>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
