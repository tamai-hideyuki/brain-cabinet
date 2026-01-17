/**
 * useViewMode Hook (v7.5)
 *
 * Decision / Execution モードの状態を管理するカスタムフック
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getViewMode,
  setViewMode,
  toggleViewMode,
  subscribeToViewMode,
  getFilterCategories,
  getPriorityCategories,
  type ViewMode,
} from '../stores/viewModeStore'

export type { ViewMode }

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(getViewMode())

  useEffect(() => {
    const unsubscribe = subscribeToViewMode((newMode) => {
      setMode(newMode)
    })
    return unsubscribe
  }, [])

  const changeMode = useCallback((newMode: ViewMode) => {
    setViewMode(newMode)
  }, [])

  const toggle = useCallback(() => {
    toggleViewMode()
  }, [])

  const filterCategories = getFilterCategories(mode)
  const priorityCategories = getPriorityCategories(mode)

  return {
    mode,
    setMode: changeMode,
    toggleMode: toggle,
    isDecisionMode: mode === 'decision',
    isExecutionMode: mode === 'execution',
    filterCategories,
    priorityCategories,
  }
}
