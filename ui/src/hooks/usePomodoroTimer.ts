import { useState, useEffect, useCallback, useRef } from 'react'

const WORK_DURATION = 25 * 60 // 25分
const BREAK_DURATION = 5 * 60 // 5分
const STORAGE_KEY = 'pomodoro-sessions'
const TIMER_STATE_KEY = 'pomodoro-timer-state'

type PomodoroState = {
  isRunning: boolean
  isBreak: boolean
  remainingSeconds: number
  completedSessions: number
  isNotifying: boolean
}

type PersistedTimerState = {
  isRunning: boolean
  isBreak: boolean
  startedAt: number // タイマー開始時のタイムスタンプ
  totalDuration: number // そのセッションの合計時間（秒）
  remainingAtStart: number // 開始時の残り時間（一時停止からの再開用）
}

export type PomodoroHistory = Record<string, number>

const getTodayKey = () => {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

const loadAllSessions = (): PomodoroHistory => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    return JSON.parse(stored)
  } catch {
    return {}
  }
}

const loadCompletedSessions = (): number => {
  const data = loadAllSessions()
  const todayKey = getTodayKey()
  return data[todayKey] || 0
}

const saveCompletedSessions = (count: number) => {
  try {
    const todayKey = getTodayKey()
    const existingData = loadAllSessions()
    existingData[todayKey] = count
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData))
  } catch {
    // localStorage unavailable
  }
}

const loadTimerState = (): PersistedTimerState | null => {
  try {
    const stored = localStorage.getItem(TIMER_STATE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

const saveTimerState = (state: PersistedTimerState | null) => {
  try {
    if (state === null) {
      localStorage.removeItem(TIMER_STATE_KEY)
    } else {
      localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state))
    }
  } catch {
    // localStorage unavailable
  }
}

const calculateRestoredState = (): Partial<PomodoroState> | null => {
  const persisted = loadTimerState()
  if (!persisted) return null

  const now = Date.now()
  const elapsedSeconds = Math.floor((now - persisted.startedAt) / 1000)
  const remainingSeconds = persisted.remainingAtStart - elapsedSeconds

  if (remainingSeconds <= 0) {
    // タイマーが終了していた場合、通知状態にする
    saveTimerState(null)
    return {
      isRunning: false,
      isBreak: persisted.isBreak,
      remainingSeconds: 0,
      isNotifying: true,
    }
  }

  // まだ時間が残っている場合
  return {
    isRunning: persisted.isRunning,
    isBreak: persisted.isBreak,
    remainingSeconds,
  }
}

export const getPomodoroHistory = (): PomodoroHistory => {
  return loadAllSessions()
}

export const usePomodoroTimer = () => {
  const [state, setState] = useState<PomodoroState>(() => {
    const restored = calculateRestoredState()
    const completedSessions = loadCompletedSessions()

    if (restored) {
      return {
        isRunning: restored.isRunning ?? false,
        isBreak: restored.isBreak ?? false,
        remainingSeconds: restored.remainingSeconds ?? WORK_DURATION,
        completedSessions,
        isNotifying: restored.isNotifying ?? false,
      }
    }

    return {
      isRunning: false,
      isBreak: false,
      remainingSeconds: WORK_DURATION,
      completedSessions,
      isNotifying: false,
    }
  })

  const intervalRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    setState((prev) => {
      // タイマー開始時に状態を永続化
      saveTimerState({
        isRunning: true,
        isBreak: prev.isBreak,
        startedAt: Date.now(),
        totalDuration: prev.isBreak ? BREAK_DURATION : WORK_DURATION,
        remainingAtStart: prev.remainingSeconds,
      })
      return { ...prev, isRunning: true, isNotifying: false }
    })
  }, [])

  const pause = useCallback(() => {
    setState((prev) => {
      // 一時停止時は永続化データをクリア（残り時間は state に保持）
      saveTimerState(null)
      return { ...prev, isRunning: false }
    })
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    saveTimerState(null) // リセット時に永続化データをクリア
    setState((prev) => ({
      ...prev,
      isRunning: false,
      isBreak: false,
      remainingSeconds: WORK_DURATION,
      isNotifying: false,
    }))
  }, [clearTimer])

  const dismissNotification = useCallback(() => {
    setState((prev) => {
      const newIsBreak = !prev.isBreak
      const newCompletedSessions = prev.isBreak ? prev.completedSessions : prev.completedSessions + 1

      if (!prev.isBreak) {
        saveCompletedSessions(newCompletedSessions)
      }

      // 通知を閉じた時点で永続化データをクリア
      saveTimerState(null)

      return {
        ...prev,
        isNotifying: false,
        isBreak: newIsBreak,
        remainingSeconds: newIsBreak ? BREAK_DURATION : WORK_DURATION,
        completedSessions: newCompletedSessions,
      }
    })
  }, [])

  useEffect(() => {
    if (!state.isRunning) {
      clearTimer()
      return
    }

    intervalRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.remainingSeconds <= 1) {
          // タイマー完了時に永続化データをクリア
          saveTimerState(null)
          return {
            ...prev,
            remainingSeconds: 0,
            isRunning: false,
            isNotifying: true,
          }
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        }
      })
    }, 1000)

    return clearTimer
  }, [state.isRunning, clearTimer])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  return {
    ...state,
    formattedTime: formatTime(state.remainingSeconds),
    start,
    pause,
    reset,
    dismissNotification,
  }
}
