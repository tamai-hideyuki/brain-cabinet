import { useState, useEffect, useCallback, useRef } from 'react'
import * as pomodoroApi from '../api/pomodoroApi'

const WORK_DURATION = 25 * 60 // 25分
const BREAK_DURATION = 5 * 60 // 5分
const POLLING_INTERVAL = 5000 // 5秒

type PomodoroState = {
  isRunning: boolean
  isBreak: boolean
  remainingSeconds: number
  completedSessions: number
  isNotifying: boolean
  isLoading: boolean
}

export type PomodoroHistory = Record<string, number>

/**
 * ポモドーロ履歴を取得（API経由）
 */
export const getPomodoroHistory = async (): Promise<PomodoroHistory> => {
  try {
    return await pomodoroApi.getHistory(365)
  } catch {
    return {}
  }
}

export const usePomodoroTimer = () => {
  const [state, setState] = useState<PomodoroState>({
    isRunning: false,
    isBreak: false,
    remainingSeconds: WORK_DURATION,
    completedSessions: 0,
    isNotifying: false,
    isLoading: true,
  })

  const intervalRef = useRef<number | null>(null)
  const pollingRef = useRef<number | null>(null)
  const isMountedRef = useRef(true)

  // タイマーインターバルをクリア
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // ポーリングをクリア
  const clearPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  // サーバーから状態を取得して更新
  const fetchState = useCallback(async () => {
    try {
      const serverState = await pomodoroApi.getState()
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRunning: serverState.isRunning,
          isBreak: serverState.isBreak,
          remainingSeconds: serverState.remainingSeconds,
          completedSessions: serverState.completedSessions,
          isNotifying: serverState.isNotifying,
          isLoading: false,
        }))
      }
    } catch (error) {
      console.error('Failed to fetch pomodoro state:', error)
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    }
  }, [])

  // 初期化時にサーバーから状態を取得
  useEffect(() => {
    isMountedRef.current = true
    fetchState()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchState])

  // タイマー開始
  const start = useCallback(async () => {
    // 楽観的更新
    setState((prev) => ({ ...prev, isRunning: true, isNotifying: false }))

    try {
      const serverState = await pomodoroApi.start(state.remainingSeconds, state.isBreak)
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRunning: serverState.isRunning,
          isBreak: serverState.isBreak,
          remainingSeconds: serverState.remainingSeconds,
          completedSessions: serverState.completedSessions,
          isNotifying: serverState.isNotifying,
        }))
      }
    } catch (error) {
      console.error('Failed to start pomodoro:', error)
      // ロールバック
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isRunning: false }))
      }
    }
  }, [state.remainingSeconds, state.isBreak])

  // タイマー一時停止
  const pause = useCallback(async () => {
    // 楽観的更新
    setState((prev) => ({ ...prev, isRunning: false }))

    try {
      const serverState = await pomodoroApi.pause()
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRunning: serverState.isRunning,
          isBreak: serverState.isBreak,
          remainingSeconds: serverState.remainingSeconds,
          completedSessions: serverState.completedSessions,
          isNotifying: serverState.isNotifying,
        }))
      }
    } catch (error) {
      console.error('Failed to pause pomodoro:', error)
      // ロールバック
      if (isMountedRef.current) {
        setState((prev) => ({ ...prev, isRunning: true }))
      }
    }
  }, [])

  // タイマーリセット
  const reset = useCallback(async () => {
    clearTimer()
    // 楽観的更新
    setState((prev) => ({
      ...prev,
      isRunning: false,
      isBreak: false,
      remainingSeconds: WORK_DURATION,
      isNotifying: false,
    }))

    try {
      const serverState = await pomodoroApi.reset()
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRunning: serverState.isRunning,
          isBreak: serverState.isBreak,
          remainingSeconds: serverState.remainingSeconds,
          completedSessions: serverState.completedSessions,
          isNotifying: serverState.isNotifying,
        }))
      }
    } catch (error) {
      console.error('Failed to reset pomodoro:', error)
    }
  }, [clearTimer])

  // 通知を閉じて次のセッションへ
  const dismissNotification = useCallback(async () => {
    const currentIsBreak = state.isBreak
    const newIsBreak = !currentIsBreak
    const newCompletedSessions = currentIsBreak ? state.completedSessions : state.completedSessions + 1

    // 楽観的更新
    setState((prev) => ({
      ...prev,
      isNotifying: false,
      isBreak: newIsBreak,
      remainingSeconds: newIsBreak ? BREAK_DURATION : WORK_DURATION,
      completedSessions: newCompletedSessions,
    }))

    try {
      const serverState = await pomodoroApi.complete(currentIsBreak)
      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isRunning: serverState.isRunning,
          isBreak: serverState.isBreak,
          remainingSeconds: serverState.remainingSeconds,
          completedSessions: serverState.completedSessions,
          isNotifying: serverState.isNotifying,
        }))
      }
    } catch (error) {
      console.error('Failed to complete pomodoro session:', error)
    }
  }, [state.isBreak, state.completedSessions])

  // ローカルタイマー（1秒ごとにカウントダウン）
  useEffect(() => {
    if (!state.isRunning || state.isLoading) {
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
  }, [state.isRunning, state.isLoading, clearTimer])

  // ポーリング（タイマー実行中のみ）
  useEffect(() => {
    if (!state.isRunning || state.isLoading) {
      clearPolling()
      return
    }

    pollingRef.current = window.setInterval(() => {
      fetchState()
    }, POLLING_INTERVAL)

    return clearPolling
  }, [state.isRunning, state.isLoading, fetchState, clearPolling])

  // ページフォーカス時に状態を再取得
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchState()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchState])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [])

  return {
    isRunning: state.isRunning,
    isBreak: state.isBreak,
    remainingSeconds: state.remainingSeconds,
    completedSessions: state.completedSessions,
    isNotifying: state.isNotifying,
    isLoading: state.isLoading,
    formattedTime: formatTime(state.remainingSeconds),
    start,
    pause,
    reset,
    dismissNotification,
    refetch: fetchState,
  }
}
