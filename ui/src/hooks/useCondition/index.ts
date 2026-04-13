import { useState, useEffect, useCallback, useMemo } from 'react'
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

const toDateString = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayString = () => toDateString(new Date())

export const useCondition = () => {
  const [logs, setLogs] = useState<ConditionLog[]>([])
  const [selectedDate, setSelectedDate] = useState(todayString)
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [sensorConnected, setSensorConnected] = useState<boolean | null>(null)
  const [checkingSensor, setCheckingSensor] = useState(false)

  const isToday = useMemo(() => selectedDate === todayString(), [selectedDate])

  const loadLogs = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const result = date === todayString()
        ? await conditionApi.getToday()
        : await conditionApi.getByDate(date)
      setLogs(result)
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs(selectedDate)
  }, [selectedDate, loadLogs])

  const goToPrevDay = useCallback(() => {
    setSelectedDate(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      return toDateString(d)
    })
  }, [])

  const goToNextDay = useCallback(() => {
    setSelectedDate(prev => {
      const d = new Date(prev + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      const next = toDateString(d)
      return next > todayString() ? prev : next
    })
  }, [])

  const goToToday = useCallback(() => {
    setSelectedDate(todayString())
  }, [])

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
      if (isToday) {
        await loadLogs(selectedDate)
      }
    } finally {
      setRecording(false)
    }
  }, [isToday, selectedDate, loadLogs])

  return {
    logs,
    todayLogs: logs,
    selectedDate,
    isToday,
    loading,
    recording,
    sensorConnected,
    checkingSensor,
    checkSensor,
    record,
    goToPrevDay,
    goToNextDay,
    goToToday,
    reload: () => loadLogs(selectedDate),
  }
}
