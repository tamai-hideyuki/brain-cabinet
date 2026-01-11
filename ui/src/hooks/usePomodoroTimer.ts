import { useState, useEffect, useCallback, useRef } from 'react'

const WORK_DURATION = 25 * 60 // 25分
const BREAK_DURATION = 5 * 60 // 5分
const STORAGE_KEY = 'pomodoro-sessions'

type PomodoroState = {
  isRunning: boolean
  isBreak: boolean
  remainingSeconds: number
  completedSessions: number
  isNotifying: boolean
}

const getTodayKey = () => {
  const today = new Date()
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
}

const loadCompletedSessions = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return 0
    const data = JSON.parse(stored)
    const todayKey = getTodayKey()
    return data[todayKey] || 0
  } catch {
    return 0
  }
}

const saveCompletedSessions = (count: number) => {
  try {
    const todayKey = getTodayKey()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [todayKey]: count }))
  } catch {
    // localStorage unavailable
  }
}

export const usePomodoroTimer = () => {
  const [state, setState] = useState<PomodoroState>(() => ({
    isRunning: false,
    isBreak: false,
    remainingSeconds: WORK_DURATION,
    completedSessions: loadCompletedSessions(),
    isNotifying: false,
  }))

  const intervalRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true, isNotifying: false }))
  }, [])

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }))
  }, [])

  const reset = useCallback(() => {
    clearTimer()
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
