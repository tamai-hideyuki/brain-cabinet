/**
 * SearchOverlay - ライブラリ内検索UI
 * 検索バー + 結果リスト + テレポート機能
 */

import { useState, useMemo, useCallback } from 'react'
import type { LibraryCluster, LibraryNote } from '../../../types/library'
import './SearchOverlay.css'

type SearchResult = {
  note: LibraryNote
  clusterLabel: string
  clusterPosition: [number, number, number]
}

type Props = {
  clusters: LibraryCluster[]
  onTeleport: (position: [number, number, number], noteId: string) => void
  onHighlight: (noteIds: string[]) => void
}

export function SearchOverlay({ clusters, onTeleport, onHighlight }: Props) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // 検索結果を計算
  const searchResults = useMemo<SearchResult[]>(() => {
    if (query.length < 2) return []

    const lowerQuery = query.toLowerCase()
    const results: SearchResult[] = []

    for (const cluster of clusters) {
      for (const note of cluster.notes) {
        const titleMatch = note.title.toLowerCase().includes(lowerQuery)
        const categoryMatch = note.category?.toLowerCase().includes(lowerQuery)

        if (titleMatch || categoryMatch) {
          results.push({
            note,
            clusterLabel: cluster.label || `Cluster ${cluster.id}`,
            clusterPosition: cluster.position,
          })
        }
      }
    }

    return results.slice(0, 10) // 最大10件
  }, [query, clusters])

  // ハイライト対象のノートIDを更新
  useMemo(() => {
    const noteIds = searchResults.map((r) => r.note.id)
    onHighlight(noteIds)
  }, [searchResults, onHighlight])

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      onTeleport(result.clusterPosition, result.note.id)
      setQuery('')
      setIsFocused(false)
    },
    [onTeleport]
  )

  const handleClear = useCallback(() => {
    setQuery('')
    onHighlight([])
  }, [onHighlight])

  const showResults = isFocused && query.length >= 2

  return (
    <div className="search-overlay">
      <div className="search-container">
        <div className="search-input-wrapper">
          <svg
            className="search-icon"
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
            className="search-input"
            placeholder="ノートを検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          />
          {query && (
            <button className="search-clear" onClick={handleClear}>
              ×
            </button>
          )}
        </div>

        {showResults && (
          <div className="search-results">
            {searchResults.length === 0 ? (
              <div className="search-no-results">
                「{query}」に一致するノートがありません
              </div>
            ) : (
              searchResults.map((result) => (
                <button
                  key={result.note.id}
                  className="search-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <span className="search-result-title">
                    {result.note.isBookmarked && '📌 '}
                    {result.note.title}
                  </span>
                  <span className="search-result-cluster">
                    {result.clusterLabel}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {searchResults.length > 0 && !showResults && (
        <div className="search-hint">
          {searchResults.length}件のノートがハイライト中
        </div>
      )}
    </div>
  )
}
