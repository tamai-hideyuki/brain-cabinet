import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import { fetchIsolationStats, type IsolationStats } from '../../../api/isolationApi'
import './NetworkHealthSection.css'

type NetworkHealthSectionProps = {
  threshold?: number
}

// ゲージのパーセント計算
const calculateGaugePercent = (value: number, max: number = 1): number => {
  return Math.min(Math.max((value / max) * 100, 0), 100)
}

// 接続度のラベルと色を取得（avgIsolationScoreから健全度を算出）
const getHealthStatus = (
  avgIsolationScore: number
): { label: string; color: string } => {
  // 健全度 = 1 - 平均孤立度（孤立度が低いほど健全）
  const healthScore = 1 - avgIsolationScore
  if (healthScore >= 0.7) return { label: '良好', color: 'var(--color-success)' }
  if (healthScore >= 0.4) return { label: '普通', color: 'var(--color-warning)' }
  return { label: '要注意', color: 'var(--color-error)' }
}

// 孤立率のラベルと色を取得
const getIsolationStatus = (
  isolationRate: number
): { label: string; color: string } => {
  if (isolationRate <= 0.1) return { label: '良好', color: 'var(--color-success)' }
  if (isolationRate <= 0.3) return { label: '普通', color: 'var(--color-warning)' }
  return { label: '要注意', color: 'var(--color-error)' }
}

// 円形ゲージコンポーネント
const CircularGauge = ({
  value,
  maxValue,
  label,
  statusLabel,
  statusColor,
  unit = '%',
}: {
  value: number
  maxValue: number
  label: string
  statusLabel: string
  statusColor: string
  unit?: string
}) => {
  const percent = calculateGaugePercent(value, maxValue)
  const circumference = 2 * Math.PI * 40 // r=40
  const strokeDashoffset = circumference - (percent / 100) * circumference

  return (
    <div className="network-health__gauge">
      <div className="network-health__gauge-circle">
        <svg viewBox="0 0 100 100">
          {/* 背景円 */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="8"
          />
          {/* 進捗円 */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={statusColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            className="network-health__gauge-progress"
          />
        </svg>
        <div className="network-health__gauge-value">
          <Text variant="body">{(value * 100).toFixed(0)}{unit}</Text>
          <span className="network-health__status-label" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>
      </div>
      <span className="network-health__gauge-label">
        {label}
      </span>
    </div>
  )
}

export const NetworkHealthSection = ({
  threshold = 0.7,
}: NetworkHealthSectionProps) => {
  const [data, setData] = useState<IsolationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await fetchIsolationStats(threshold)
        setData(result)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [threshold])

  if (loading) {
    return (
      <div className="network-health network-health--loading">
        <Spinner size="sm" />
        <Text variant="caption">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="network-health network-health--error">
        <Text variant="caption">{error}</Text>
      </div>
    )
  }

  if (!data || data.totalNotes === 0) {
    return (
      <div className="network-health">
        <div className="network-health__header">
          <Text variant="subtitle">ネットワーク健全性</Text>
        </div>
        <div className="network-health__empty">
          <Text variant="caption">データがありません</Text>
        </div>
      </div>
    )
  }

  const isolationRate = data.isolatedCount / data.totalNotes
  const connectedRate = data.wellConnectedCount / data.totalNotes
  // 健全度 = 1 - 平均孤立度（0〜1のスケール）
  const healthScore = 1 - data.avgIsolationScore
  const healthStatus = getHealthStatus(data.avgIsolationScore)
  const isolationStatus = getIsolationStatus(isolationRate)

  return (
    <div className="network-health">
      <div className="network-health__header">
        <Text variant="subtitle">ネットワーク健全性</Text>
        <Text variant="caption">{data.totalNotes}件のノート</Text>
      </div>

      {/* ゲージ表示 */}
      <div className="network-health__gauges">
        <CircularGauge
          value={healthScore}
          maxValue={1}
          label="ネットワーク健全度"
          statusLabel={healthStatus.label}
          statusColor={healthStatus.color}
        />
        <CircularGauge
          value={isolationRate}
          maxValue={1}
          label="孤立率"
          statusLabel={isolationStatus.label}
          statusColor={isolationStatus.color}
        />
      </div>

      {/* 詳細統計 */}
      <div className="network-health__stats">
        <div className="network-health__stat">
          <Text variant="caption">良好接続</Text>
          <span className="network-health__stat-value network-health__stat-value--success">
            {data.wellConnectedCount}件
          </span>
          <Text variant="caption">({(connectedRate * 100).toFixed(0)}%)</Text>
        </div>
        <div className="network-health__stat">
          <Text variant="caption">孤立ノート</Text>
          <span className="network-health__stat-value network-health__stat-value--warning">
            {data.isolatedCount}件
          </span>
          <Text variant="caption">({(isolationRate * 100).toFixed(0)}%)</Text>
        </div>
        <div className="network-health__stat">
          <Text variant="caption">未接続</Text>
          <span className="network-health__stat-value network-health__stat-value--error">
            {data.noEdgesCount}件
          </span>
          <Text variant="caption">
            ({((data.noEdgesCount / data.totalNotes) * 100).toFixed(0)}%)
          </Text>
        </div>
      </div>

      {/* ヘルスインジケーター */}
      <div className="network-health__indicator">
        {isolationRate > 0.3 ? (
          <span className="network-health__message network-health__alert">
            孤立ノートが多めです。関連付けを検討してください。
          </span>
        ) : healthScore < 0.4 ? (
          <span className="network-health__message network-health__alert">
            健全度が低めです。ノート間の関係を強化しましょう。
          </span>
        ) : (
          <span className="network-health__message network-health__success">
            ネットワークは健全な状態です。
          </span>
        )}
      </div>
    </div>
  )
}
