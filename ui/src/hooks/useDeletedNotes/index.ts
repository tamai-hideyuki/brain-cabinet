import { useState, useEffect, useCallback } from 'react'
import { fetchDeletedNotes, restoreNote, type DeletedNote } from '../../api/notesApi'

const EXPIRATION_SECONDS = 3600 // 1時間

export type DeletedNoteWithCountdown = DeletedNote & {
  remainingSeconds: number
  isExpiringSoon: boolean // 5分以内
}

export const useDeletedNotes = () => {
  const [notes, setNotes] = useState<DeletedNoteWithCountdown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  // 残り時間を計算
  const calculateRemainingSeconds = useCallback((deletedAt: number): number => {
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = deletedAt + EXPIRATION_SECONDS
    return Math.max(0, expiresAt - now)
  }, [])

  // ノート一覧にカウントダウン情報を追加
  const enrichWithCountdown = useCallback((noteList: DeletedNote[]): DeletedNoteWithCountdown[] => {
    return noteList.map((note) => {
      const remainingSeconds = calculateRemainingSeconds(note.deletedAt)
      return {
        ...note,
        remainingSeconds,
        isExpiringSoon: remainingSeconds <= 300, // 5分以内
      }
    })
  }, [calculateRemainingSeconds])

  // データ取得
  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDeletedNotes()
      setNotes(enrichWithCountdown(result.notes))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch deleted notes')
    } finally {
      setLoading(false)
    }
  }, [enrichWithCountdown])

  // 初回読み込み
  useEffect(() => {
    reload()
  }, [reload])

  // カウントダウン更新（1秒ごと）
  useEffect(() => {
    if (notes.length === 0) return

    const interval = setInterval(() => {
      setNotes((prev) =>
        prev
          .map((note) => {
            const remainingSeconds = calculateRemainingSeconds(note.deletedAt)
            return {
              ...note,
              remainingSeconds,
              isExpiringSoon: remainingSeconds <= 300,
            }
          })
          .filter((note) => note.remainingSeconds > 0) // 期限切れは除外
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [notes.length, calculateRemainingSeconds])

  // 復元処理
  const restore = useCallback(async (id: string) => {
    setRestoring(id)
    try {
      await restoreNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restore note')
    } finally {
      setRestoring(null)
    }
  }, [])

  return {
    notes,
    loading,
    error,
    restoring,
    reload,
    restore,
  }
}
