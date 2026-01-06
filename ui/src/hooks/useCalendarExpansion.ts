/**
 * useCalendarExpansion - カレンダーの展開状態を管理するフック
 */

import { useState, useCallback } from 'react'

export type ExpansionState = {
  expandedYears: Set<number>
  expandedMonths: Set<string> // "2024-01" 形式
  expandedDays: Set<string> // "2024-01-15" 形式
}

export type ExpansionActions = {
  toggleYear: (year: number) => void
  toggleMonth: (monthKey: string) => void
  toggleDay: (dateKey: string) => void
  expandYear: (year: number) => void
  expandMonth: (monthKey: string) => void
  expandDay: (dateKey: string) => void
  collapseYear: (year: number) => void
  collapseMonth: (monthKey: string) => void
  collapseDay: (dateKey: string) => void
  collapseAll: () => void
  isYearExpanded: (year: number) => boolean
  isMonthExpanded: (monthKey: string) => boolean
  isDayExpanded: (dateKey: string) => boolean
}

export function useCalendarExpansion(): [ExpansionState, ExpansionActions] {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set())
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  // Year actions
  const toggleYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) {
        next.delete(year)
      } else {
        next.add(year)
      }
      return next
    })
  }, [])

  const expandYear = useCallback((year: number) => {
    setExpandedYears((prev) => new Set(prev).add(year))
  }, [])

  const collapseYear = useCallback((year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      next.delete(year)
      return next
    })
    // その年の月も閉じる
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      for (const key of prev) {
        if (key.startsWith(`${year}-`)) {
          next.delete(key)
        }
      }
      return next
    })
    // その年の日も閉じる
    setExpandedDays((prev) => {
      const next = new Set(prev)
      for (const key of prev) {
        if (key.startsWith(`${year}-`)) {
          next.delete(key)
        }
      }
      return next
    })
  }, [])

  // Month actions
  const toggleMonth = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) {
        next.delete(monthKey)
      } else {
        next.add(monthKey)
      }
      return next
    })
  }, [])

  const expandMonth = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => new Set(prev).add(monthKey))
  }, [])

  const collapseMonth = useCallback((monthKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev)
      next.delete(monthKey)
      return next
    })
    // その月の日も閉じる
    setExpandedDays((prev) => {
      const next = new Set(prev)
      for (const key of prev) {
        if (key.startsWith(`${monthKey}-`)) {
          next.delete(key)
        }
      }
      return next
    })
  }, [])

  // Day actions
  const toggleDay = useCallback((dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) {
        next.delete(dateKey)
      } else {
        next.add(dateKey)
      }
      return next
    })
  }, [])

  const expandDay = useCallback((dateKey: string) => {
    setExpandedDays((prev) => new Set(prev).add(dateKey))
  }, [])

  const collapseDay = useCallback((dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      next.delete(dateKey)
      return next
    })
  }, [])

  // Collapse all
  const collapseAll = useCallback(() => {
    setExpandedYears(new Set())
    setExpandedMonths(new Set())
    setExpandedDays(new Set())
  }, [])

  // Check expansion state
  const isYearExpanded = useCallback(
    (year: number) => expandedYears.has(year),
    [expandedYears]
  )

  const isMonthExpanded = useCallback(
    (monthKey: string) => expandedMonths.has(monthKey),
    [expandedMonths]
  )

  const isDayExpanded = useCallback(
    (dateKey: string) => expandedDays.has(dateKey),
    [expandedDays]
  )

  const state: ExpansionState = {
    expandedYears,
    expandedMonths,
    expandedDays,
  }

  const actions: ExpansionActions = {
    toggleYear,
    toggleMonth,
    toggleDay,
    expandYear,
    expandMonth,
    expandDay,
    collapseYear,
    collapseMonth,
    collapseDay,
    collapseAll,
    isYearExpanded,
    isMonthExpanded,
    isDayExpanded,
  }

  return [state, actions]
}
