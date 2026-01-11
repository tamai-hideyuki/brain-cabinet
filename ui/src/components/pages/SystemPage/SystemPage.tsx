import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../../templates/MainLayout'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import {
  fetchStorageStats,
  type StorageStats,
  type TableInfo,
  listVoiceEvaluations,
  getVoiceEvaluation,
  getVoiceEvaluationSummary,
  clearVoiceEvaluations,
  type EvaluationListItem,
  type EvaluationSummary,
} from '../../../api/systemApi'
import {
  getMetricsSummary,
  clearMetrics,
  type MetricsSummary,
} from '../../../stores/metricsStore'
import { useDataChangeSubscription } from '../../../hooks/useDataChangeSubscription'
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

  // Voice Evaluation state
  const [voiceEvaluations, setVoiceEvaluations] = useState<EvaluationListItem[]>([])
  const [voiceSummary, setVoiceSummary] = useState<EvaluationSummary | null>(null)
  const [selectedMarkdown, setSelectedMarkdown] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [storageData, metricsData, voiceData, summaryData] = await Promise.all([
        fetchStorageStats(),
        getMetricsSummary(),
        listVoiceEvaluations(20),
        getVoiceEvaluationSummary(),
      ])
      setStats(storageData)
      setMetrics(metricsData)
      setVoiceEvaluations(voiceData.evaluations)
      setVoiceSummary(summaryData)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました')
    }
  }, [])

  // 初回読み込み
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await loadData()
      setLoading(false)
    }
    load()
  }, [loadData])

  // データ変更時に自動更新（1秒デバウンス）
  useDataChangeSubscription(loadData, 1000)

  const handleClearMetrics = async () => {
    await clearMetrics()
    const metricsData = await getMetricsSummary()
    setMetrics(metricsData)
  }

  // Voice Evaluation handlers
  const handleShowMarkdown = async (id: number) => {
    try {
      const detail = await getVoiceEvaluation(id)
      setSelectedMarkdown(detail.markdown)
    } catch (e) {
      setError(e instanceof Error ? e.message : '詳細取得に失敗しました')
    }
  }

  const handleCopyMarkdown = async () => {
    if (selectedMarkdown) {
      await navigator.clipboard.writeText(selectedMarkdown)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleClearVoiceEvaluations = async () => {
    await clearVoiceEvaluations()
    setVoiceEvaluations([])
    setVoiceSummary({ totalEvaluations: 0, avgAssertionRate: 0, avgCausalRate: 0, structureSeparationRate: 0 })
    setSelectedMarkdown(null)
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

        {/* Voice Evaluation（観測者ルール評価） */}
        <div className="system-page__section" id="voice-evaluation">
          <div className="system-page__section-header">
            <Text variant="subtitle">Voice Evaluation（観測者ルール評価）</Text>
            {voiceEvaluations.length > 0 && (
              <button
                className="system-page__clear-btn"
                onClick={handleClearVoiceEvaluations}
              >
                クリア
              </button>
            )}
          </div>

          {voiceSummary && voiceSummary.totalEvaluations > 0 ? (
            <>
              <div className="system-page__summary">
                <div className="system-page__summary-card">
                  <Text variant="caption">評価件数</Text>
                  <Text variant="title">{formatNumber(voiceSummary.totalEvaluations)}</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均断定率</Text>
                  <Text variant="title">{voiceSummary.avgAssertionRate}%</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均因果率</Text>
                  <Text variant="title">{voiceSummary.avgCausalRate}%</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">構造分離率</Text>
                  <Text variant="title">{voiceSummary.structureSeparationRate}%</Text>
                </div>
              </div>

              <div className="system-page__metrics-section">
                <span className="system-page__metrics-label">評価履歴</span>
                <div className="system-page__table-wrapper">
                  <table className="system-page__table">
                    <thead>
                      <tr>
                        <th className="system-page__table-header">クラスタ</th>
                        <th className="system-page__table-header system-page__table-header--right">断定率</th>
                        <th className="system-page__table-header system-page__table-header--right">因果率</th>
                        <th className="system-page__table-header">構造分離</th>
                        <th className="system-page__table-header">詳細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voiceEvaluations.map((ev) => (
                        <tr key={ev.id} className="system-page__table-row">
                          <td className="system-page__table-cell system-page__table-cell--name">
                            <span className="system-page__table-label">{ev.clusterName}</span>
                            <span className="system-page__table-name">#{ev.clusterId} / {ev.promptVersion}</span>
                          </td>
                          <td className="system-page__table-cell system-page__table-cell--count">
                            {ev.assertionRate}%
                          </td>
                          <td className="system-page__table-cell system-page__table-cell--count">
                            {ev.causalRate}%
                          </td>
                          <td className="system-page__table-cell">
                            {ev.structureSeparated ? '○' : '×'}
                          </td>
                          <td className="system-page__table-cell">
                            <button
                              className="system-page__clear-btn"
                              onClick={() => handleShowMarkdown(ev.id)}
                            >
                              表示
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedMarkdown && (
                <div className="system-page__metrics-section">
                  <div className="system-page__section-header">
                    <span className="system-page__metrics-label">Markdownレポート（コピー用）</span>
                    <button
                      className="system-page__clear-btn"
                      onClick={handleCopyMarkdown}
                    >
                      {copySuccess ? 'コピーしました' : 'コピー'}
                    </button>
                  </div>
                  <div className="system-page__markdown-preview">
                    <pre className="system-page__markdown-content">{selectedMarkdown}</pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="system-page__empty-metrics">
              <Text variant="body">まだ評価データがありません。GPT Actionsでクラスタ人格化を実行すると記録されます。</Text>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
