import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { usePTM } from './index'
import * as ptmApi from '../../api/ptmApi'
import type { PtmSummary } from '../../types/ptm'

vi.mock('../../api/ptmApi')

const mockPtm: PtmSummary = {
  date: '2024-01-15',
  mode: 'exploration',
  season: 'balanced',
  state: 'stable',
  growthAngle: 45,
  trend: 'rising',
  dominantCluster: 1,
  topClusters: [
    {
      clusterId: 1,
      keywords: ['test', 'mock'],
      noteCount: 10,
      cohesion: 0.8,
      role: 'driver',
      drift: { contribution: 0.5, trend: 'rising' },
      influence: { hubness: 0.7, authority: 0.6 },
    },
  ],
  coach: {
    today: 'Focus on exploration',
    tomorrow: 'Continue consolidation',
    balance: 'Good balance',
    warning: null,
  },
}

describe('usePTM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(ptmApi.fetchPtmSummary).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => usePTM())

    expect(result.current.loading).toBe(true)
    expect(result.current.ptm).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('PTMサマリーを取得する', async () => {
    vi.mocked(ptmApi.fetchPtmSummary).mockResolvedValue(mockPtm)

    const { result } = renderHook(() => usePTM())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.ptm).toEqual(mockPtm)
    expect(result.current.error).toBeNull()
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(ptmApi.fetchPtmSummary).mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => usePTM())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('API error')
    expect(result.current.ptm).toBeNull()
  })

  it('reloadでPTMを再取得する', async () => {
    vi.mocked(ptmApi.fetchPtmSummary).mockResolvedValue(mockPtm)

    const { result } = renderHook(() => usePTM())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(ptmApi.fetchPtmSummary).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(ptmApi.fetchPtmSummary).toHaveBeenCalledTimes(2)
  })

  it('Error以外の例外でもUnknown errorがセットされる', async () => {
    vi.mocked(ptmApi.fetchPtmSummary).mockRejectedValue('string error')

    const { result } = renderHook(() => usePTM())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Unknown error')
  })
})
