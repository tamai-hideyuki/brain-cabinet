import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import {
  fetchSemanticDiffTimeline,
  type SemanticDiffDataPoint,
} from '../../../api/analyticsApi'
import './ThinkingTrendSection.css'

type ThinkingTrendSectionProps = {
  range?: string
}

const formatDate = (dateStr: string): string => {
  // YYYY-MM-DD形式を直接パースしてタイムゾーン問題を回避
  const [, month, day] = dateStr.split('-').map(Number)
  return `${month}/${day}`
}

export const ThinkingTrendSection = ({ range = '7d' }: ThinkingTrendSectionProps) => {
  const [data, setData] = useState<SemanticDiffDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const result = await fetchSemanticDiffTimeline(range)

        // APIからのデータをマップに変換
        const dataMap = new Map<string, SemanticDiffDataPoint>()
        for (const point of result.data) {
          dataMap.set(point.date, point)
        }

        // 指定日数分の全日付を生成（データがない日も含む）
        const days = parseInt(range.replace('d', ''), 10) || 7
        const filledData: SemanticDiffDataPoint[] = []
        const today = new Date()

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(date.getDate() - i)
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

          const existing = dataMap.get(dateStr)
          filledData.push(
            existing || { date: dateStr, avgSemanticDiff: 0, noteCount: 0 }
          )
        }

        setData(filledData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [range])

  if (loading) {
    return (
      <div className="thinking-trend thinking-trend--loading">
        <Spinner size="sm" />
        <Text variant="caption">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="thinking-trend thinking-trend--error">
        <Text variant="caption">{error}</Text>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="thinking-trend">
        <div className="thinking-trend__header">
          <Text variant="subtitle">思考トレンド</Text>
        </div>
        <div className="thinking-trend__empty">
          <Text variant="caption">データがありません</Text>
        </div>
      </div>
    )
  }

  // 最大値を計算してチャートのスケールを決定
  const maxDiff = Math.max(...data.map((d) => d.avgSemanticDiff), 0.1)
  const maxNotes = Math.max(...data.map((d) => d.noteCount), 1)

  // 期間内のトータル統計
  const totalNotes = data.reduce((sum, d) => sum + d.noteCount, 0)
  const avgDiff =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.avgSemanticDiff, 0) / data.length
      : 0

  // 最も活発だった日を取得
  const mostActiveDay = data.reduce(
    (max, d) => (d.noteCount > max.noteCount ? d : max),
    data[0]
  )

  return (
    <div className="thinking-trend">
      <div className="thinking-trend__header">
        <Text variant="subtitle">思考トレンド</Text>
        <Text variant="caption">過去{range.replace('d', '日')}</Text>
      </div>

      {/* サマリー統計 */}
      <div className="thinking-trend__summary">
        <div className="thinking-trend__stat">
          <Text variant="caption">総変更数</Text>
          <Text variant="body">{totalNotes}件</Text>
        </div>
        <div className="thinking-trend__stat">
          <Text variant="caption">平均変化度</Text>
          <Text variant="body">{(avgDiff * 100).toFixed(1)}%</Text>
        </div>
        <div className="thinking-trend__stat">
          <Text variant="caption">最活発日</Text>
          <Text variant="body">
            {formatDate(mostActiveDay.date)} ({mostActiveDay.noteCount}件)
          </Text>
        </div>
      </div>

      {/* チャート */}
      <div className="thinking-trend__chart">
        <div className="thinking-trend__chart-bars">
          {data.map((point, index) => {
            const diffHeight = (point.avgSemanticDiff / maxDiff) * 100
            const noteHeight = (point.noteCount / maxNotes) * 100
            const isToday = index === data.length - 1

            return (
              <div
                key={point.date}
                className={`thinking-trend__bar-group ${isToday ? 'thinking-trend__bar-group--today' : ''}`}
              >
                <div className="thinking-trend__bars">
                  {/* セマンティック差分バー */}
                  <div
                    className="thinking-trend__bar thinking-trend__bar--diff"
                    style={{ height: `${Math.max(diffHeight, 4)}%` }}
                    title={`変化度: ${(point.avgSemanticDiff * 100).toFixed(1)}%`}
                  />
                  {/* ノート数バー */}
                  <div
                    className="thinking-trend__bar thinking-trend__bar--notes"
                    style={{ height: `${Math.max(noteHeight, 4)}%` }}
                    title={`変更数: ${point.noteCount}`}
                  />
                </div>
                <div className="thinking-trend__bar-label">
                  <Text variant="caption">{formatDate(point.date)}</Text>
                </div>
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="thinking-trend__legend">
          <div className="thinking-trend__legend-item">
            <span className="thinking-trend__legend-color thinking-trend__legend-color--diff" />
            <Text variant="caption">変化度</Text>
          </div>
          <div className="thinking-trend__legend-item">
            <span className="thinking-trend__legend-color thinking-trend__legend-color--notes" />
            <Text variant="caption">変更数</Text>
          </div>
        </div>
      </div>
    </div>
  )
}
