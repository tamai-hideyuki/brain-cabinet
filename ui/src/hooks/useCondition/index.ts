import { useState, useEffect, useCallback } from 'react'
import type { ConditionLog } from '../../api/conditionApi'
import * as conditionApi from '../../api/conditionApi'

export const CONDITION_OPTIONS = [
  { label: '絶好調', color: '#ff4500' },
  { label: '好調', color: '#4ecdc4' },
  { label: '普通', color: '#95a5a6' },
  { label: '疲れてきた', color: '#f39c12' },
  { label: 'しんどい', color: '#e74c3c' },
  { label: '眠い', color: '#9b59b6' },
  { label: '気分悪い', color: '#2ecc71' },
] as const

export const useCondition = () => {
  const [todayLogs, setTodayLogs] = useState<ConditionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [sensorConnected, setSensorConnected] = useState<boolean | null>(null)
  const [checkingSensor, setCheckingSensor] = useState(false)

  const loadToday = useCallback(async () => {
    try {
      const logs = await conditionApi.getToday()
      setTodayLogs(logs)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadToday()
  }, [loadToday])

  const checkSensor = useCallback(async () => {
    setCheckingSensor(true)
    try {
      const result = await conditionApi.checkSensor()
      setSensorConnected(result.connected)
    } catch {
      setSensorConnected(false)
    } finally {
      setCheckingSensor(false)
    }
  }, [])

  const record = useCallback(async (label: string) => {
    setRecording(true)
    try {
      await conditionApi.record(label)
      await loadToday()
    } finally {
      setRecording(false)
    }
  }, [loadToday])

  return {
    todayLogs,
    loading,
    recording,
    sensorConnected,
    checkingSensor,
    checkSensor,
    record,
    reload: loadToday,
  }
}
