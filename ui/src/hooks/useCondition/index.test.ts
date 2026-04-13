import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCondition } from './index'
import * as conditionApi from '../../api/conditionApi'
import type { ConditionLog } from '../../api/conditionApi'

vi.mock('../../api/conditionApi')

const mockLog = (overrides: Partial<ConditionLog> = {}): ConditionLog => ({
  id: 1,
  label: '好調',
  temperature: 25.1,
  humidity: 48,
  pressure: 1013,
  recordedAt: Math.floor(Date.now() / 1000),
  ...overrides,
})

describe('useCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(conditionApi.getToday).mockResolvedValue([])
    vi.mocked(conditionApi.getByDate).mockResolvedValue([])
    vi.mocked(conditionApi.checkSensor).mockResolvedValue({ connected: true })
    vi.mocked(conditionApi.record).mockResolvedValue(mockLog())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** hookの初期マウントを完了させるヘルパー */
  const setupHook = async () => {
    const hook = renderHook(() => useCondition())
    await waitFor(() => {
      expect(hook.result.current.loading).toBe(false)
    })
    return hook
  }

  it('初期状態で今日のログを取得する', async () => {
    // 準備
    const logs = [mockLog()]
    vi.mocked(conditionApi.getToday).mockResolvedValue(logs)

    // 実行
    const { result } = await setupHook()

    // 結果
    expect(result.current.logs).toEqual(logs)
    expect(result.current.isToday).toBe(true)
    expect(conditionApi.getToday).toHaveBeenCalledTimes(1)
    expect(conditionApi.getByDate).not.toHaveBeenCalled()
  })

  it('goToPrevDayで前日に切り替わりgetByDateが呼ばれる', async () => {
    // 準備
    const pastLogs = [mockLog({ label: '普通' })]
    vi.mocked(conditionApi.getByDate).mockResolvedValue(pastLogs)
    const { result } = await setupHook()

    // 実行
    await act(async () => {
      result.current.goToPrevDay()
    })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // 結果
    expect(result.current.isToday).toBe(false)
    expect(result.current.logs).toEqual(pastLogs)
    expect(conditionApi.getByDate).toHaveBeenCalled()
  })

  it('goToNextDayで今日を超えない', async () => {
    // 準備
    const { result } = await setupHook()
    const dateBefore = result.current.selectedDate

    // 実行
    await act(async () => {
      result.current.goToNextDay()
    })

    // 結果
    expect(result.current.selectedDate).toBe(dateBefore)
    expect(result.current.isToday).toBe(true)
  })

  it('goToPrevDay後にgoToNextDayで翌日に進む', async () => {
    // 準備
    const { result } = await setupHook()
    const todayDate = result.current.selectedDate
    await act(async () => {
      result.current.goToPrevDay()
    })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.selectedDate).not.toBe(todayDate)

    // 実行
    await act(async () => {
      result.current.goToNextDay()
    })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // 結果
    expect(result.current.selectedDate).toBe(todayDate)
    expect(result.current.isToday).toBe(true)
  })

  it('goToTodayで今日に戻りgetTodayが呼ばれる', async () => {
    // 準備
    const { result } = await setupHook()
    await act(async () => {
      result.current.goToPrevDay()
    })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isToday).toBe(false)
    vi.mocked(conditionApi.getToday).mockClear()

    // 実行
    await act(async () => {
      result.current.goToToday()
    })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // 結果
    expect(result.current.isToday).toBe(true)
    expect(conditionApi.getToday).toHaveBeenCalled()
  })

  it('record後に今日ならログを再取得する', async () => {
    // 準備
    const { result } = await setupHook()
    vi.mocked(conditionApi.getToday).mockClear()
    const updatedLogs = [mockLog({ label: '絶好調' })]
    vi.mocked(conditionApi.getToday).mockResolvedValue(updatedLogs)

    // 実行
    await act(async () => {
      await result.current.record('絶好調')
    })

    // 結果
    expect(conditionApi.record).toHaveBeenCalledWith('絶好調')
    expect(conditionApi.getToday).toHaveBeenCalled()
    expect(result.current.logs).toEqual(updatedLogs)
  })

  it('ログ取得失敗時はsilent failする', async () => {
    // 準備
    vi.mocked(conditionApi.getToday).mockRejectedValue(new Error('network error'))

    // 実行
    const { result } = await setupHook()

    // 結果
    expect(result.current.logs).toEqual([])
  })
})
