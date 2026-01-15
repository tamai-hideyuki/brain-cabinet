/**
 * Timeline Adapter
 * API呼び出しと型変換を担当
 */

import { fetchNotes } from '../api/notesApi'
import type { CalendarNote } from '../utils/calendarHierarchy'

// 型をre-export
export type { CalendarNote }

/**
 * カレンダー表示用のノート一覧を取得
 */
export const getCalendarNotes = async (): Promise<CalendarNote[]> => {
  // limit: 0 で全件取得
  const result = await fetchNotes({ limit: 0 })

  // API結果をCalendarNote型に変換
  return result.notes.map((n) => ({
    id: n.id,
    title: n.title,
    category: n.category,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }))
}
