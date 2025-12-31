import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Spinner } from '../../atoms/Spinner'
import { fetchSemanticDiffTimeline, type SemanticDiffDataPoint } from '../../../api/analyticsApi'
import './ActivityCalendarSection.css'

type ActivityCalendarSectionProps = {
  range?: string
}

// 日付をパース（YYYY-MM-DD形式）
const parseDate = (dateStr: string): { year: number; month: number; day: number } => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return { year, month, day }
}

// 曜日を取得（0=日曜）
const getDayOfWeek = (dateStr: string): number => {
  const { year, month, day } = parseDate(dateStr)
  return new Date(year, month - 1, day).getDay()
}

// 活動レベルを計算（0-4）
const getActivityLevel = (count: number, maxCount: number): number => {
  if (count === 0) return 0
  if (maxCount === 0) return 0
  const ratio = count / maxCount
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

// 月の短縮名
const getMonthLabel = (month: number): string => {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  return months[month - 1]
}

export const ActivityCalendarSection = ({
  range = '30d',
}: ActivityCalendarSectionProps) => {
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

        // 過去30日分の全日付を生成（データがない日も含む）
        const days = parseInt(range.replace('d', ''), 10) || 30
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
      <div className="activity-calendar activity-calendar--loading">
        <Spinner size="sm" />
        <Text variant="caption">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="activity-calendar activity-calendar--error">
        <Text variant="caption">{error}</Text>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="activity-calendar">
        <div className="activity-calendar__header">
          <Text variant="subtitle">活動カレンダー</Text>
        </div>
        <div className="activity-calendar__empty">
          <Text variant="caption">データがありません</Text>
        </div>
      </div>
    )
  }

  // 最大活動数を計算
  const maxCount = Math.max(...data.map((d) => d.noteCount))

  // 総活動数
  const totalActivity = data.reduce((sum, d) => sum + d.noteCount, 0)

  // 活動日数
  const activeDays = data.filter((d) => d.noteCount > 0).length

  // データを週ごとにグループ化
  // 最新の日付から逆順で表示（右が新しい）
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date))

  // 週ごとにグループ化（各週は日曜始まり）
  const weeks: (SemanticDiffDataPoint | null)[][] = []
  let currentWeek: (SemanticDiffDataPoint | null)[] = []

  // 最初の日の曜日に応じて空セルを追加
  if (sortedData.length > 0) {
    const firstDayOfWeek = getDayOfWeek(sortedData[0].date)
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null)
    }
  }

  for (const point of sortedData) {
    currentWeek.push(point)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // 最後の週が7日未満の場合、空セルで埋める
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }

  // 月ラベルを生成（週内のすべての日を確認して月の変わり目を検出）
  const monthLabels: { month: number; weekIndex: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, weekIndex) => {
    for (const day of week) {
      if (day) {
        const { month } = parseDate(day.date)
        if (month !== lastMonth) {
          monthLabels.push({ month, weekIndex })
          lastMonth = month
        }
      }
    }
  })

  return (
    <div className="activity-calendar">
      <div className="activity-calendar__header">
        <Text variant="subtitle">活動カレンダー</Text>
        <Text variant="caption">過去30日</Text>
      </div>

      {/* サマリー */}
      <div className="activity-calendar__summary">
        <div className="activity-calendar__stat">
          <span className="activity-calendar__stat-value">{totalActivity}</span>
          <Text variant="caption">総活動</Text>
        </div>
        <div className="activity-calendar__stat">
          <span className="activity-calendar__stat-value">{activeDays}</span>
          <Text variant="caption">活動日</Text>
        </div>
        <div className="activity-calendar__stat">
          <span className="activity-calendar__stat-value">
            {activeDays > 0 ? (totalActivity / activeDays).toFixed(1) : 0}
          </span>
          <Text variant="caption">日平均</Text>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="activity-calendar__grid-container">
        {/* 月ラベル */}
        <div className="activity-calendar__month-labels">
          {monthLabels.map(({ month, weekIndex }) => (
            <span
              key={`${month}-${weekIndex}`}
              className="activity-calendar__month-label"
              style={{ gridColumn: weekIndex + 1 }}
            >
              {getMonthLabel(month)}
            </span>
          ))}
        </div>

        {/* 曜日ラベル */}
        <div className="activity-calendar__day-labels">
          <span className="activity-calendar__day-label">日</span>
          <span className="activity-calendar__day-label">月</span>
          <span className="activity-calendar__day-label">火</span>
          <span className="activity-calendar__day-label">水</span>
          <span className="activity-calendar__day-label">木</span>
          <span className="activity-calendar__day-label">金</span>
          <span className="activity-calendar__day-label">土</span>
        </div>

        {/* ヒートマップグリッド */}
        <div className="activity-calendar__grid">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="activity-calendar__week">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`activity-calendar__cell activity-calendar__cell--level-${
                    day ? getActivityLevel(day.noteCount, maxCount) : 'empty'
                  }`}
                  title={
                    day
                      ? `${day.date}: ${day.noteCount}件の活動`
                      : ''
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 凡例 */}
      <div className="activity-calendar__legend">
        <Text variant="caption">少</Text>
        <div className="activity-calendar__legend-cells">
          <div className="activity-calendar__cell activity-calendar__cell--level-0" />
          <div className="activity-calendar__cell activity-calendar__cell--level-1" />
          <div className="activity-calendar__cell activity-calendar__cell--level-2" />
          <div className="activity-calendar__cell activity-calendar__cell--level-3" />
          <div className="activity-calendar__cell activity-calendar__cell--level-4" />
        </div>
        <Text variant="caption">多</Text>
      </div>
    </div>
  )
}
