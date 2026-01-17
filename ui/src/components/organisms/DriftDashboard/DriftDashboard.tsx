/**
 * DriftDashboard Component (v7.5)
 *
 * ドリフト（思考変化）の可視化ダッシュボード
 * - タイムラインチャート（drift + EMA）
 * - フェーズ表示（creation/destruction/neutral）
 * - 状態・トレンド表示
 */

import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Spinner } from '../../atoms/Spinner'
import {
  getDriftTimeline,
  getPhaseCounts,
  getPhaseLabel,
  getPhaseIcon,
  getPhaseDescription,
  getStateLabel,
  getTrendIcon,
  getTrendLabel,
  type DriftTimelineResponse,
  type DriftPhase,
  type DriftState,
} from '../../../adapters/driftAdapter'
import './DriftDashboard.css'

type DriftDashboardProps = {
  rangeDays?: number
}

const formatDate = (dateStr: string): string => {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${month}/${day}`
}

const getStateVariant = (state: DriftState): 'default' | 'decision' | 'learning' => {
  if (state === 'stable') return 'learning'
  if (state === 'overheat') return 'decision'
  return 'default'
}

export const DriftDashboard = ({ rangeDays = 14 }: DriftDashboardProps) => {
  const [data, setData] = useState<DriftTimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await getDriftTimeline(rangeDays)
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [rangeDays])

  if (loading) {
    return (
      <div className="drift-dashboard drift-dashboard--loading">
        <Spinner size="sm" />
        <Text variant="caption">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="drift-dashboard drift-dashboard--error">
        <Text variant="caption">{error}</Text>
      </div>
    )
  }

  if (!data || data.days.length === 0) {
    return (
      <div className="drift-dashboard">
        <div className="drift-dashboard__header">
          <Text variant="subtitle">思考ドリフト</Text>
        </div>
        <div className="drift-dashboard__empty">
          <Text variant="caption">データがありません</Text>
        </div>
      </div>
    )
  }

  const { days, summary } = data
  const maxDrift = Math.max(...days.map((d) => d.drift), 0.1)
  const maxEma = Math.max(...days.map((d) => d.ema), 0.1)
  const maxValue = Math.max(maxDrift, maxEma)

  // フェーズ別の日数を集計
  const phaseCounts = getPhaseCounts(days)

  // 今日のフェーズ
  const todayPhase = days.length > 0 ? (days[days.length - 1].phase ?? 'neutral') : 'neutral'

  return (
    <div className="drift-dashboard">
      <div className="drift-dashboard__header">
        <div className="drift-dashboard__title">
          <Text variant="subtitle">思考ドリフト</Text>
          <Badge variant={getStateVariant(summary.state)}>
            {getStateLabel(summary.state)}
          </Badge>
        </div>
        <div className="drift-dashboard__trend">
          <span className="drift-dashboard__trend-icon">
            {getTrendIcon(summary.trend)}
          </span>
          <Text variant="caption">{getTrendLabel(summary.trend)}</Text>
        </div>
      </div>

      {/* 今日のフェーズ */}
      <div className="drift-dashboard__today-phase">
        <div className="drift-dashboard__phase-badge">
          <span className="drift-dashboard__phase-icon">{getPhaseIcon(todayPhase)}</span>
          <Text variant="body">{getPhaseLabel(todayPhase)}</Text>
        </div>
        <Text variant="caption">{getPhaseDescription(todayPhase)}</Text>
      </div>

      {/* サマリー */}
      <div className="drift-dashboard__summary">
        <div className="drift-dashboard__stat">
          <Text variant="caption">今日のドリフト</Text>
          <Text variant="body">{(summary.todayDrift * 100).toFixed(1)}%</Text>
        </div>
        <div className="drift-dashboard__stat">
          <Text variant="caption">EMA</Text>
          <Text variant="body">{(summary.todayEMA * 100).toFixed(1)}%</Text>
        </div>
        <div className="drift-dashboard__stat">
          <Text variant="caption">平均</Text>
          <Text variant="body">{(summary.mean * 100).toFixed(1)}%</Text>
        </div>
      </div>

      {/* フェーズ分布 */}
      <div className="drift-dashboard__phase-distribution">
        <Text variant="caption">フェーズ分布（{rangeDays}日間）</Text>
        <div className="drift-dashboard__phase-bars">
          {(['creation', 'destruction', 'neutral'] as DriftPhase[]).map((phase) => {
            const count = phaseCounts[phase] || 0
            const percentage = days.length > 0 ? (count / days.length) * 100 : 0
            return (
              <div key={phase} className="drift-dashboard__phase-bar-item">
                <div className="drift-dashboard__phase-bar-info">
                  <span>{getPhaseIcon(phase)}</span>
                  <Text variant="caption">{getPhaseLabel(phase)}</Text>
                  <Text variant="caption">{count}日</Text>
                </div>
                <div className="drift-dashboard__phase-bar-track">
                  <div
                    className={`drift-dashboard__phase-bar-fill drift-dashboard__phase-bar-fill--${phase}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* タイムラインチャート */}
      <div className="drift-dashboard__chart">
        <div className="drift-dashboard__chart-bars">
          {days.map((day, index) => {
            const driftHeight = (day.drift / maxValue) * 100
            const emaHeight = (day.ema / maxValue) * 100
            const isToday = index === days.length - 1
            const phase = day.phase ?? 'neutral'

            return (
              <div
                key={day.date}
                className={`drift-dashboard__bar-group ${isToday ? 'drift-dashboard__bar-group--today' : ''}`}
                title={`${formatDate(day.date)}: ${getPhaseLabel(phase)}`}
              >
                <div className="drift-dashboard__bars">
                  {/* ドリフトバー */}
                  <div
                    className={`drift-dashboard__bar drift-dashboard__bar--drift drift-dashboard__bar--${phase}`}
                    style={{ height: `${Math.max(driftHeight, 4)}%` }}
                    title={`ドリフト: ${(day.drift * 100).toFixed(1)}%`}
                  />
                  {/* EMAライン */}
                  <div
                    className="drift-dashboard__ema-marker"
                    style={{ bottom: `${emaHeight}%` }}
                  />
                </div>
                <div className="drift-dashboard__bar-phase">
                  <span className="drift-dashboard__bar-phase-dot" data-phase={phase} />
                </div>
                <div className="drift-dashboard__bar-label">
                  <Text variant="caption">{formatDate(day.date)}</Text>
                </div>
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="drift-dashboard__legend">
          <div className="drift-dashboard__legend-item">
            <span className="drift-dashboard__legend-color drift-dashboard__legend-color--creation" />
            <Text variant="caption">創造</Text>
          </div>
          <div className="drift-dashboard__legend-item">
            <span className="drift-dashboard__legend-color drift-dashboard__legend-color--destruction" />
            <Text variant="caption">収束</Text>
          </div>
          <div className="drift-dashboard__legend-item">
            <span className="drift-dashboard__legend-color drift-dashboard__legend-color--neutral" />
            <Text variant="caption">安定</Text>
          </div>
          <div className="drift-dashboard__legend-item">
            <span className="drift-dashboard__legend-color drift-dashboard__legend-color--ema" />
            <Text variant="caption">EMA</Text>
          </div>
        </div>
      </div>
    </div>
  )
}
