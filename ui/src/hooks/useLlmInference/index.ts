/**
 * useLlmInference Hook
 *
 * LLM推論機能のための React Hook
 */

import { useState, useEffect, useCallback } from 'react'
import type {
  GetCandidatesResult,
  LlmInferenceExecuteResult,
  GetPendingResult,
  WeeklySummary,
  OllamaHealthStatus,
  LlmInferenceActionResult,
} from '../../types/llmInference'
import type { NoteType } from '../../types/note'
import * as api from '../../api/llmInferenceApi'

// ============================================================
// Ollamaヘルスチェック
// ============================================================

export const useOllamaHealth = () => {
  const [health, setHealth] = useState<OllamaHealthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.checkHealth()
      setHealth(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  return { health, loading, error, recheck: check }
}

// ============================================================
// 週次サマリー
// ============================================================

export const useWeeklySummary = () => {
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getWeeklySummary()
      setSummary(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { summary, loading, error, reload: load }
}

// ============================================================
// 推論候補
// ============================================================

export const useLlmCandidates = (autoLoad = true) => {
  const [candidates, setCandidates] = useState<GetCandidatesResult | null>(null)
  const [loading, setLoading] = useState(autoLoad)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (params?: api.GetCandidatesParams) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getCandidates(params)
      setCandidates(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      load()
    }
  }, [autoLoad, load])

  return { candidates, loading, error, reload: load }
}

// ============================================================
// 推論実行
// ============================================================

export const useLlmExecute = () => {
  const [result, setResult] = useState<LlmInferenceExecuteResult | null>(null)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (params?: api.ExecuteParams) => {
    setExecuting(true)
    setError(null)
    try {
      const result = await api.execute(params)
      setResult(result)
      return result
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      throw e
    } finally {
      setExecuting(false)
    }
  }, [])

  return { result, executing, error, execute }
}

// ============================================================
// 保留管理
// ============================================================

export const usePendingResults = (autoLoad = true) => {
  const [pending, setPending] = useState<GetPendingResult | null>(null)
  const [loading, setLoading] = useState(autoLoad)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (params?: api.GetPendingParams) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getPending(params)
      setPending(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      load()
    }
  }, [autoLoad, load])

  const approve = useCallback(
    async (resultId: number): Promise<LlmInferenceActionResult> => {
      const result = await api.approve(resultId)
      if (result.success) {
        await load() // リロード
      }
      return result
    },
    [load]
  )

  const reject = useCallback(
    async (resultId: number): Promise<LlmInferenceActionResult> => {
      const result = await api.reject(resultId)
      if (result.success) {
        await load() // リロード
      }
      return result
    },
    [load]
  )

  const override = useCallback(
    async (
      resultId: number,
      type: NoteType,
      reason?: string
    ): Promise<LlmInferenceActionResult> => {
      const result = await api.override({ resultId, type, reason })
      if (result.success) {
        await load() // リロード
      }
      return result
    },
    [load]
  )

  return { pending, loading, error, reload: load, approve, reject, override }
}

// ============================================================
// コスト見積もり
// ============================================================

export const useEstimateCost = () => {
  const [estimate, setEstimate] = useState<api.EstimateCostResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (params?: api.GetCandidatesParams) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.estimateCost(params)
      setEstimate(result)
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { estimate, loading, error, load }
}
