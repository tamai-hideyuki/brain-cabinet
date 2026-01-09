/**
 * データ変更購読フック
 *
 * データ変更イベントを購読し、デバウンス付きでコールバックを実行する
 */

import { useEffect, useRef, useCallback } from 'react'
import { subscribeToDataChanges } from '../stores/dataChangeStore'

/**
 * データ変更を購読し、デバウンス付きでコールバックを実行するフック
 *
 * @param callback データ変更時に実行するコールバック
 * @param debounceMs デバウンス時間（ミリ秒）。デフォルト1000ms
 * @param enabled 購読を有効にするか。デフォルトtrue
 */
export function useDataChangeSubscription(
  callback: () => void,
  debounceMs: number = 1000,
  enabled: boolean = true
): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // コールバックを最新に保つ
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const debouncedCallback = useCallback(() => {
    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // 新しいタイマーをセット
    timeoutRef.current = setTimeout(() => {
      callbackRef.current()
      timeoutRef.current = null
    }, debounceMs)
  }, [debounceMs])

  useEffect(() => {
    if (!enabled) return

    const unsubscribe = subscribeToDataChanges(debouncedCallback)

    return () => {
      unsubscribe()
      // クリーンアップ時にタイマーもクリア
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [debouncedCallback, enabled])
}
