import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useOllamaHealth,
  useWeeklySummary,
  useLlmCandidates,
  useLlmExecute,
  usePendingResults,
  useEstimateCost,
} from './index'
import * as api from '../../api/llmInferenceApi'
import type {
  OllamaHealthStatus,
  WeeklySummary,
  GetCandidatesResult,
  LlmInferenceExecuteResult,
  GetPendingResult,
} from '../../types/llmInference'

vi.mock('../../api/llmInferenceApi')

// ============================================================
// モックデータ
// ============================================================

const mockHealthStatus: OllamaHealthStatus = {
  available: true,
  modelLoaded: true,
  model: 'qwen2.5:3b',
  message: 'Ollama準備完了',
}

const mockWeeklySummary: WeeklySummary = {
  weekStart: '2025-12-27',
  weekEnd: '2026-01-03',
  stats: {
    autoAppliedHigh: 5,
    autoAppliedMid: 3,
    pendingCount: 2,
    approvedCount: 1,
    overriddenCount: 1,
  },
  recentAutoApplied: [
    {
      noteId: 'note-1',
      title: 'Test Note 1',
      type: 'learning',
      confidence: 0.78,
      reasoning: 'Contains learning patterns',
      createdAt: 1735372800,
    },
  ],
  pendingItems: [
    {
      id: 1,
      noteId: 'note-2',
      title: 'Test Note 2',
      currentType: 'scratch',
      suggestedType: 'decision',
      confidence: 0.65,
      reasoning: 'Contains decision patterns',
      createdAt: 1735376400,
    },
  ],
}

const mockCandidates: GetCandidatesResult = {
  count: 1,
  candidates: [
    {
      noteId: 'note-3',
      title: 'Candidate Note',
      currentType: 'scratch',
      currentConfidence: 0.45,
      reason: 'Low confidence note',
    },
  ],
}

const mockExecuteResult: LlmInferenceExecuteResult = {
  executed: 1,
  results: [
    {
      noteId: 'note-3',
      type: 'learning',
      confidence: 0.88,
      status: 'auto_applied',
      reasoning: 'Contains learning patterns',
    },
  ],
}

const mockPendingResult: GetPendingResult = {
  count: 1,
  items: [
    {
      id: 1,
      noteId: 'note-2',
      title: 'Test Note 2',
      currentType: 'scratch',
      suggestedType: 'decision',
      confidence: 0.65,
      reasoning: 'Contains decision patterns',
      createdAt: 1735376400,
    },
  ],
}

const mockEstimateCost: api.EstimateCostResult = {
  candidateCount: 5,
  estimatedCost: 0,
  estimatedTimeSeconds: 30,
  message: 'ローカルLLM（Ollama）のため無料',
}

// ============================================================
// useOllamaHealth
// ============================================================

describe('useOllamaHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(api.checkHealth).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useOllamaHealth())

    expect(result.current.loading).toBe(true)
    expect(result.current.health).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('ヘルス情報を取得する', async () => {
    vi.mocked(api.checkHealth).mockResolvedValue(mockHealthStatus)

    const { result } = renderHook(() => useOllamaHealth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.health).toEqual(mockHealthStatus)
    expect(result.current.error).toBeNull()
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(api.checkHealth).mockRejectedValue(new Error('Connection failed'))

    const { result } = renderHook(() => useOllamaHealth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Connection failed')
    expect(result.current.health).toBeNull()
  })

  it('recheckでヘルス情報を再取得する', async () => {
    vi.mocked(api.checkHealth).mockResolvedValue(mockHealthStatus)

    const { result } = renderHook(() => useOllamaHealth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.checkHealth).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.recheck()
    })

    expect(api.checkHealth).toHaveBeenCalledTimes(2)
  })
})

// ============================================================
// useWeeklySummary
// ============================================================

describe('useWeeklySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがtrueになる', () => {
    vi.mocked(api.getWeeklySummary).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useWeeklySummary())

    expect(result.current.loading).toBe(true)
    expect(result.current.summary).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('週次サマリーを取得する', async () => {
    vi.mocked(api.getWeeklySummary).mockResolvedValue(mockWeeklySummary)

    const { result } = renderHook(() => useWeeklySummary())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.summary).toEqual(mockWeeklySummary)
    expect(result.current.error).toBeNull()
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(api.getWeeklySummary).mockRejectedValue(new Error('API error'))

    const { result } = renderHook(() => useWeeklySummary())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('API error')
    expect(result.current.summary).toBeNull()
  })

  it('reloadで週次サマリーを再取得する', async () => {
    vi.mocked(api.getWeeklySummary).mockResolvedValue(mockWeeklySummary)

    const { result } = renderHook(() => useWeeklySummary())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.getWeeklySummary).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(api.getWeeklySummary).toHaveBeenCalledTimes(2)
  })
})

// ============================================================
// useLlmCandidates
// ============================================================

describe('useLlmCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('autoLoad=trueで自動的に候補を取得する', async () => {
    vi.mocked(api.getCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => useLlmCandidates(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.candidates).toEqual(mockCandidates)
    expect(api.getCandidates).toHaveBeenCalledTimes(1)
  })

  it('autoLoad=falseで自動取得しない', async () => {
    vi.mocked(api.getCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => useLlmCandidates(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.candidates).toBeNull()
    expect(api.getCandidates).not.toHaveBeenCalled()
  })

  it('reloadで候補を再取得する', async () => {
    vi.mocked(api.getCandidates).mockResolvedValue(mockCandidates)

    const { result } = renderHook(() => useLlmCandidates(false))

    await act(async () => {
      await result.current.reload({ limit: 10 })
    })

    expect(api.getCandidates).toHaveBeenCalledWith({ limit: 10 })
    expect(result.current.candidates).toEqual(mockCandidates)
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(api.getCandidates).mockRejectedValue(new Error('Fetch error'))

    const { result } = renderHook(() => useLlmCandidates(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Fetch error')
    expect(result.current.candidates).toBeNull()
  })
})

// ============================================================
// useLlmExecute
// ============================================================

describe('useLlmExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でexecutingがfalseになる', () => {
    const { result } = renderHook(() => useLlmExecute())

    expect(result.current.executing).toBe(false)
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('推論を実行して結果を取得する', async () => {
    vi.mocked(api.execute).mockResolvedValue(mockExecuteResult)

    const { result } = renderHook(() => useLlmExecute())

    let executeResult: LlmInferenceExecuteResult | undefined
    await act(async () => {
      executeResult = await result.current.execute({ noteIds: ['note-3'] })
    })

    expect(executeResult).toEqual(mockExecuteResult)
    expect(result.current.result).toEqual(mockExecuteResult)
    expect(result.current.error).toBeNull()
    expect(api.execute).toHaveBeenCalledWith({ noteIds: ['note-3'] })
  })

  it('実行中はexecutingがtrueになる', async () => {
    let resolvePromise: (value: LlmInferenceExecuteResult) => void
    vi.mocked(api.execute).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve
      })
    )

    const { result } = renderHook(() => useLlmExecute())

    act(() => {
      result.current.execute()
    })

    expect(result.current.executing).toBe(true)

    await act(async () => {
      resolvePromise!(mockExecuteResult)
    })

    expect(result.current.executing).toBe(false)
  })

  it('エラー時にerrorがセットされて例外がスローされる', async () => {
    vi.mocked(api.execute).mockRejectedValue(new Error('Execution failed'))

    const { result } = renderHook(() => useLlmExecute())

    await act(async () => {
      try {
        await result.current.execute()
      } catch {
        // 例外は期待通り
      }
    })

    expect(result.current.error).toBe('Execution failed')
    expect(result.current.executing).toBe(false)
  })
})

// ============================================================
// usePendingResults
// ============================================================

describe('usePendingResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('autoLoad=trueで自動的に保留を取得する', async () => {
    vi.mocked(api.getPending).mockResolvedValue(mockPendingResult)

    const { result } = renderHook(() => usePendingResults(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.pending).toEqual(mockPendingResult)
    expect(api.getPending).toHaveBeenCalledTimes(1)
  })

  it('autoLoad=falseで自動取得しない', () => {
    vi.mocked(api.getPending).mockResolvedValue(mockPendingResult)

    const { result } = renderHook(() => usePendingResults(false))

    expect(result.current.loading).toBe(false)
    expect(result.current.pending).toBeNull()
    expect(api.getPending).not.toHaveBeenCalled()
  })

  it('approveが成功すると自動リロードする', async () => {
    vi.mocked(api.getPending).mockResolvedValue(mockPendingResult)
    vi.mocked(api.approve).mockResolvedValue({ success: true, message: '承認しました' })

    const { result } = renderHook(() => usePendingResults(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.getPending).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.approve(1)
    })

    expect(api.approve).toHaveBeenCalledWith(1)
    expect(api.getPending).toHaveBeenCalledTimes(2)
  })

  it('overrideが成功すると自動リロードする', async () => {
    vi.mocked(api.getPending).mockResolvedValue(mockPendingResult)
    vi.mocked(api.override).mockResolvedValue({ success: true, message: '上書きしました' })

    const { result } = renderHook(() => usePendingResults(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.getPending).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.override(1, 'learning', 'User reason')
    })

    expect(api.override).toHaveBeenCalledWith({
      resultId: 1,
      type: 'learning',
      reason: 'User reason',
    })
    expect(api.getPending).toHaveBeenCalledTimes(2)
  })

  it('approveが失敗するとリロードしない', async () => {
    vi.mocked(api.getPending).mockResolvedValue(mockPendingResult)
    vi.mocked(api.approve).mockResolvedValue({ success: false, message: 'Not found' })

    const { result } = renderHook(() => usePendingResults(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(api.getPending).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.approve(999)
    })

    expect(api.getPending).toHaveBeenCalledTimes(1) // リロードしない
  })

  it('エラー時にerrorがセットされる', async () => {
    vi.mocked(api.getPending).mockRejectedValue(new Error('Load error'))

    const { result } = renderHook(() => usePendingResults(true))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Load error')
    expect(result.current.pending).toBeNull()
  })
})

// ============================================================
// useEstimateCost
// ============================================================

describe('useEstimateCost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期状態でloadingがfalseになる', () => {
    const { result } = renderHook(() => useEstimateCost())

    expect(result.current.loading).toBe(false)
    expect(result.current.estimate).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('コスト見積もりを取得する', async () => {
    vi.mocked(api.estimateCost).mockResolvedValue(mockEstimateCost)

    const { result } = renderHook(() => useEstimateCost())

    let loadResult: api.EstimateCostResult | undefined
    await act(async () => {
      loadResult = await result.current.load()
    })

    expect(loadResult).toEqual(mockEstimateCost)
    expect(result.current.estimate).toEqual(mockEstimateCost)
    expect(result.current.error).toBeNull()
  })

  it('パラメータ付きでコスト見積もりを取得する', async () => {
    vi.mocked(api.estimateCost).mockResolvedValue(mockEstimateCost)

    const { result } = renderHook(() => useEstimateCost())

    await act(async () => {
      await result.current.load({ limit: 5 })
    })

    expect(api.estimateCost).toHaveBeenCalledWith({ limit: 5 })
  })

  it('エラー時にerrorがセットされて例外がスローされる', async () => {
    vi.mocked(api.estimateCost).mockRejectedValue(new Error('Estimate failed'))

    const { result } = renderHook(() => useEstimateCost())

    await act(async () => {
      try {
        await result.current.load()
      } catch {
        // 例外は期待通り
      }
    })

    expect(result.current.error).toBe('Estimate failed')
    expect(result.current.estimate).toBeNull()
  })
})
