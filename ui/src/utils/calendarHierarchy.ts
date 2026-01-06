/**
 * calendarHierarchy.ts - ノートを年→月→日の階層構造に変換
 */

export type CalendarNote = {
  id: string
  title: string
  category: string | null
  createdAt: number
  updatedAt: number
}

export type CalendarDay = {
  day: number
  dateKey: string // "2024-01-15"
  notes: CalendarNote[]
}

export type CalendarMonth = {
  month: number // 1-12
  monthKey: string // "2024-01"
  label: string // "1月"
  days: CalendarDay[]
  totalNotes: number
}

export type CalendarYear = {
  year: number
  months: CalendarMonth[]
  totalNotes: number
}

export type CalendarHierarchy = {
  years: CalendarYear[]
}

/**
 * 月のラベルを取得
 */
function getMonthLabel(month: number): string {
  return `${month}月`
}

/**
 * ノートをカレンダー階層に変換
 */
export function buildCalendarHierarchy(notes: CalendarNote[]): CalendarHierarchy {
  // 日付でグループ化
  const notesByDate = new Map<string, CalendarNote[]>()

  for (const note of notes) {
    const date = new Date(note.updatedAt * 1000)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    if (!notesByDate.has(dateKey)) {
      notesByDate.set(dateKey, [])
    }
    notesByDate.get(dateKey)!.push(note)
  }

  // 年→月→日の階層を構築
  const yearMap = new Map<number, Map<number, CalendarDay[]>>()

  for (const [dateKey, dayNotes] of notesByDate) {
    const [yearStr, monthStr, dayStr] = dateKey.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const day = parseInt(dayStr, 10)

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map())
    }
    const monthMap = yearMap.get(year)!

    if (!monthMap.has(month)) {
      monthMap.set(month, [])
    }
    monthMap.get(month)!.push({
      day,
      dateKey,
      notes: dayNotes.sort((a, b) => b.updatedAt - a.updatedAt), // 新しい順
    })
  }

  // CalendarYear配列に変換
  const years: CalendarYear[] = []

  for (const [year, monthMap] of yearMap) {
    const months: CalendarMonth[] = []

    for (const [month, days] of monthMap) {
      // 日を昇順でソート
      days.sort((a, b) => a.day - b.day)

      const totalNotes = days.reduce((sum, d) => sum + d.notes.length, 0)

      months.push({
        month,
        monthKey: `${year}-${String(month).padStart(2, '0')}`,
        label: getMonthLabel(month),
        days,
        totalNotes,
      })
    }

    // 月を昇順でソート
    months.sort((a, b) => a.month - b.month)

    const totalNotes = months.reduce((sum, m) => sum + m.totalNotes, 0)

    years.push({
      year,
      months,
      totalNotes,
    })
  }

  // 年を降順でソート（新しい年が先）
  years.sort((a, b) => b.year - a.year)

  return { years }
}

/**
 * 特定の月の日数を取得
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 特定の月の最初の日の曜日を取得（0=日曜, 1=月曜, ...）
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}
