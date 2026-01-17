import { useState } from 'react'
import { MainLayout } from '../../templates/MainLayout'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import { useSystemInfo } from '../../../hooks/useSystemInfo'
import type { TableInfo } from '../../../api/systemApi'
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

const formatUptime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}日 ${hours % 24}時間`
  if (hours > 0) return `${hours}時間 ${minutes % 60}分`
  if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`
  return `${seconds}秒`
}

const getPhaseLabel = (phase: string | null): string => {
  if (!phase) return '-'
  const labels: Record<string, string> = {
    creation: '創造',
    destruction: '収束',
    neutral: '安定',
  }
  return labels[phase] || phase
}

const getPhaseIcon = (phase: string | null): string => {
  if (!phase) return ''
  const icons: Record<string, string> = {
    creation: '🌱',
    destruction: '🔥',
    neutral: '⚖️',
  }
  return icons[phase] || ''
}

export const SystemPage = () => {
  const {
    stats,
    health,
    metrics,
    voiceEvaluations,
    voiceSummary,
    v75Stats,
    loading,
    healthLoading,
    error,
    refreshHealthCheck,
    resetMetrics,
    getVoiceEvaluationMarkdown,
    resetVoiceEvaluations,
  } = useSystemInfo()

  const [selectedMarkdown, setSelectedMarkdown] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const handleShowMarkdown = async (id: number) => {
    try {
      const markdown = await getVoiceEvaluationMarkdown(id)
      setSelectedMarkdown(markdown)
    } catch {
      // エラーはhookで処理される
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
    await resetVoiceEvaluations()
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

        {/* ヘルスチェック */}
        {!loading && (
          <div className="system-page__section" id="health">
            <div className="system-page__section-header">
              <Text variant="subtitle">サーバーヘルスチェック</Text>
              <button
                className="system-page__clear-btn"
                onClick={refreshHealthCheck}
                disabled={healthLoading}
              >
                {healthLoading ? '実行中...' : '再実行'}
              </button>
            </div>

            {health ? (
              <>
                <div className="system-page__health-status">
                  <div className={`system-page__health-indicator system-page__health-indicator--${health.status}`}>
                    <span className="system-page__health-icon">
                      {health.status === 'healthy' ? '●' : health.status === 'degraded' ? '●' : '●'}
                    </span>
                    <span className="system-page__health-label">
                      {health.status === 'healthy' ? '正常稼働中' : health.status === 'degraded' ? '一部機能に問題あり' : '障害発生中'}
                    </span>
                  </div>
                  <div className="system-page__health-time">
                    最終チェック: {new Date(health.timestamp).toLocaleString('ja-JP')}
                  </div>
                </div>

                <div className="system-page__summary">
                  <div className="system-page__summary-card">
                    <Text variant="caption">稼働時間</Text>
                    <Text variant="title">{formatUptime(health.uptime)}</Text>
                  </div>
                  <div className="system-page__summary-card">
                    <Text variant="caption">データベース</Text>
                    <div className="system-page__health-item">
                      <span className={`system-page__health-dot system-page__health-dot--${health.checks.database.status}`} />
                      <Text variant="title">
                        {health.checks.database.latency !== undefined
                          ? `${health.checks.database.latency}ms`
                          : '-'}
                      </Text>
                    </div>
                  </div>
                  <div className="system-page__summary-card">
                    <Text variant="caption">ストレージ</Text>
                    <div className="system-page__health-item">
                      <span className={`system-page__health-dot system-page__health-dot--${health.checks.storage.status}`} />
                      <Text variant="title">{formatNumber(health.checks.storage.notesCount)}件</Text>
                    </div>
                  </div>
                </div>

                <div className="system-page__health-details">
                  <div className="system-page__health-detail-row">
                    <span className="system-page__health-detail-label">DB:</span>
                    <span className="system-page__health-detail-value">{health.checks.database.message}</span>
                  </div>
                  <div className="system-page__health-detail-row">
                    <span className="system-page__health-detail-label">Storage:</span>
                    <span className="system-page__health-detail-value">{health.checks.storage.message}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="system-page__empty-metrics">
                <Text variant="body">ヘルスチェックを実行中...</Text>
              </div>
            )}
          </div>
        )}

        {/* v7.5 統計 */}
        {!loading && v75Stats && (
          <div className="system-page__section" id="v75-stats">
            <div className="system-page__section-header">
              <Text variant="subtitle">v7.5 思考フェーズ統計</Text>
            </div>

            <div className="system-page__summary">
              <div className="system-page__summary-card">
                <Text variant="caption">今日のフェーズ</Text>
                <Text variant="title">
                  {getPhaseIcon(v75Stats.drift.todayPhase)} {getPhaseLabel(v75Stats.drift.todayPhase)}
                </Text>
              </div>
              <div className="system-page__summary-card">
                <Text variant="caption">現在のEMA</Text>
                <Text variant="title">{(v75Stats.drift.currentEma * 100).toFixed(1)}%</Text>
              </div>
              <div className="system-page__summary-card">
                <Text variant="caption">平均ドリフト</Text>
                <Text variant="title">{(v75Stats.drift.averageDrift * 100).toFixed(1)}%</Text>
              </div>
              <div className="system-page__summary-card">
                <Text variant="caption">計測日数</Text>
                <Text variant="title">{v75Stats.drift.totalDays}日</Text>
              </div>
            </div>

            <div className="system-page__metrics-section">
              <span className="system-page__metrics-label">フェーズ分布（30日間）</span>
              <div className="system-page__phase-distribution">
                {(['creation', 'destruction', 'neutral'] as const).map((phase) => {
                  const count = v75Stats.drift.phaseCounts[phase] || 0
                  const percentage = v75Stats.drift.totalDays > 0 ? (count / v75Stats.drift.totalDays) * 100 : 0
                  return (
                    <div key={phase} className="system-page__phase-item">
                      <div className="system-page__phase-info">
                        <span>{getPhaseIcon(phase)}</span>
                        <span>{getPhaseLabel(phase)}</span>
                        <span>{count}日</span>
                      </div>
                      <div className="system-page__phase-bar-track">
                        <div
                          className={`system-page__phase-bar-fill system-page__phase-bar-fill--${phase}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="system-page__metrics-section">
              <span className="system-page__metrics-label">クラスタ人格化</span>
              <div className="system-page__summary">
                <div className="system-page__summary-card">
                  <Text variant="caption">評価済みクラスタ</Text>
                  <Text variant="title">{v75Stats.personalization.evaluatedClusters}件</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均断定率</Text>
                  <Text variant="title">{v75Stats.personalization.avgAssertionRate}%</Text>
                </div>
                <div className="system-page__summary-card">
                  <Text variant="caption">平均因果率</Text>
                  <Text variant="title">{v75Stats.personalization.avgCausalRate}%</Text>
                </div>
              </div>
            </div>
          </div>
        )}

        {stats && !loading && (
          <>
            <div className="system-page__section" id="storage">
              <Text variant="subtitle">ストレージ統計</Text>
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
                onClick={resetMetrics}
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
