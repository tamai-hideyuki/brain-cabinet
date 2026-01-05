/**
 * TimelineSearchOverlay - タイムライン内検索UI
 * 検索バー + 結果リスト + ハイライト機能
 */

import { useState, useMemo, useCallback } from 'react'
import type { TimelineNote } from './TimelinePath'
import './TimelineSearchOverlay.css'

type SearchResult = {
  note: TimelineNote
  dateLabel: string
}

type Props = {
  notes: TimelineNote[]
  onHighlight: (noteIds: string[]) => void
  onSelectNote: (noteId: string) => void
}

/**
 * 日付をフォーマット（今日、昨日、または日付）
 */
function formatDateLabel(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (dateStr === todayStr) {
    return '今日'
  }
  if (dateStr === yesterdayStr) {
    return '昨日'
  }

  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })
}

export function TimelineSearchOverlay({ notes, onHighlight, onSelectNote }: Props) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // 検索結果を計算
  const searchResults = useMemo<SearchResult[]>(() => {
    if (query.length < 2) return []

    const lowerQuery = query.toLowerCase()
    const results: SearchResult[] = []

    for (const note of notes) {
      const titleMatch = note.title.toLowerCase().includes(lowerQuery)
      const categoryMatch = note.category?.toLowerCase().includes(lowerQuery)

      if (titleMatch || categoryMatch) {
        results.push({
          note,
          dateLabel: formatDateLabel(note.updatedAt),
        })
      }
    }

    // 更新日時でソート（新しい順）
    results.sort((a, b) => b.note.updatedAt - a.note.updatedAt)

    return results.slice(0, 10) // 最大10件（表示用）
  }, [query, notes])

  // すべての検索マッチをハイライト（表示件数制限なし）
  const allMatchingIds = useMemo(() => {
    if (query.length < 2) return []

    const lowerQuery = query.toLowerCase()
    const ids: string[] = []

    for (const note of notes) {
      const titleMatch = note.title.toLowerCase().includes(lowerQuery)
      const categoryMatch = note.category?.toLowerCase().includes(lowerQuery)

      if (titleMatch || categoryMatch) {
        ids.push(note.id)
      }
    }

    return ids
  }, [query, notes])

  // ハイライト対象のノートIDを更新
  useMemo(() => {
    onHighlight(allMatchingIds)
  }, [allMatchingIds, onHighlight])

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onSelectNote(result.note.id)
      setQuery('')
      setIsFocused(false)
    },
    [onSelectNote]
  )

  const handleClear = useCallback(() => {
    setQuery('')
    onHighlight([])
  }, [onHighlight])

  const showResults = isFocused && query.length >= 2

  return (
    <div className="timeline-search-overlay">
      <div className="timeline-search-container">
        <div className="timeline-search-input-wrapper">
          <svg
            className="timeline-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="timeline-search-input"
            placeholder="ノートを検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          />
          {query && (
            <button className="timeline-search-clear" onClick={handleClear}>
              ×
            </button>
          )}
        </div>

        {showResults && (
          <div className="timeline-search-results">
            {searchResults.length === 0 ? (
              <div className="timeline-search-no-results">
                「{query}」に一致するノートがありません
              </div>
            ) : (
              searchResults.map((result) => (
                <button
                  key={result.note.id}
                  className="timeline-search-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <span className="timeline-search-result-title">
                    {result.note.title || '(無題)'}
                  </span>
                  <span className="timeline-search-result-date">
                    {result.dateLabel}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {allMatchingIds.length > 0 && !showResults && (
        <div className="timeline-search-hint">
          {allMatchingIds.length}件のノートがハイライト中
        </div>
      )}
    </div>
  )
}
