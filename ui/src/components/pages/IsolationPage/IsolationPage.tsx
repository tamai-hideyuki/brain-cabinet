import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../../templates/MainLayout'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import {
  fetchIsolatedNotes,
  fetchIsolationStats,
  fetchIntegrationSuggestions,
  type IsolatedNote,
  type IsolationStats,
  type IntegrationSuggestion,
} from '../../../api/isolationApi'
import './IsolationPage.css'

export const IsolationPage = () => {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<IsolatedNote[]>([])
  const [stats, setStats] = useState<IsolationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0.7)
  const [selectedNote, setSelectedNote] = useState<IsolatedNote | null>(null)
  const [suggestions, setSuggestions] = useState<IntegrationSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [threshold])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [notesData, statsData] = await Promise.all([
        fetchIsolatedNotes(threshold, 50),
        fetchIsolationStats(threshold),
      ])
      setNotes(notesData)
      setStats(statsData)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleNoteClick = (note: IsolatedNote) => {
    setSelectedNote(note)
    loadSuggestions(note.noteId)
  }

  const loadSuggestions = async (noteId: string) => {
    setSuggestionsLoading(true)
    try {
      const data = await fetchIntegrationSuggestions(noteId, 5)
      setSuggestions(data)
    } catch (e) {
      console.error('Failed to load suggestions:', e)
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const handleNavigateToNote = (noteId: string) => {
    navigate(`/ui/notes/${noteId}`)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="isolation-page__loading">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="isolation-page__error">
          <Text variant="body">{error}</Text>
          <Button variant="primary" onClick={loadData}>
            再読み込み
          </Button>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="isolation-page">
        <header className="isolation-page__header">
          <div className="isolation-page__title-row">
            <Text variant="title">未統合の思考</Text>
            <Text variant="caption">
              他のノートとの関連が薄いアイデアを見つけて統合しましょう
            </Text>
          </div>
        </header>

        {/* 統計情報 */}
        {stats && (
          <div className="isolation-page__stats">
            <div className="isolation-page__stat-card">
              <Text variant="caption">孤立ノート</Text>
              <Text variant="subtitle">{stats.isolatedCount}件</Text>
            </div>
            <div className="isolation-page__stat-card">
              <Text variant="caption">接続良好</Text>
              <Text variant="subtitle">{stats.wellConnectedCount}件</Text>
            </div>
            <div className="isolation-page__stat-card">
              <Text variant="caption">エッジなし</Text>
              <Text variant="subtitle">{stats.noEdgesCount}件</Text>
            </div>
            <div className="isolation-page__stat-card">
              <Text variant="caption">平均孤立度</Text>
              <Text variant="subtitle">
                {Math.round(stats.avgIsolationScore * 100)}%
              </Text>
            </div>
          </div>
        )}

        {/* フィルター */}
        <div className="isolation-page__filter">
          <Text variant="caption">孤立度しきい値:</Text>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="isolation-page__select"
          >
            <option value={0.5}>50%以上</option>
            <option value={0.6}>60%以上</option>
            <option value={0.7}>70%以上（デフォルト）</option>
            <option value={0.8}>80%以上</option>
            <option value={0.9}>90%以上</option>
          </select>
        </div>

        <div className="isolation-page__content">
          {/* ノート一覧 */}
          <div className="isolation-page__list">
            {notes.length === 0 ? (
              <div className="isolation-page__empty">
                <Text variant="body">孤立ノートはありません</Text>
              </div>
            ) : (
              notes.map((note) => (
                <button
                  key={note.noteId}
                  className={`isolation-page__note-item ${selectedNote?.noteId === note.noteId ? 'isolation-page__note-item--selected' : ''}`}
                  onClick={() => handleNoteClick(note)}
                >
                  <div className="isolation-page__note-main">
                    <Text variant="body" truncate>
                      {note.title}
                    </Text>
                    <div className="isolation-page__note-meta">
                      {note.category && (
                        <Badge variant="default">{note.category}</Badge>
                      )}
                      <Text variant="caption">{formatDate(note.updatedAt)}</Text>
                    </div>
                  </div>
                  <div className="isolation-page__note-score">
                    <div
                      className={`isolation-page__score-bar ${note.isolationScore >= 0.9 ? 'isolation-page__score-bar--critical' : note.isolationScore >= 0.8 ? 'isolation-page__score-bar--high' : ''}`}
                      style={{ width: `${note.isolationScore * 100}%` }}
                    />
                    <Text variant="caption">
                      {Math.round(note.isolationScore * 100)}%
                    </Text>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 詳細パネル */}
          {selectedNote && (
            <div className="isolation-page__detail">
              <div className="isolation-page__detail-header">
                <Text variant="subtitle">{selectedNote.title}</Text>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleNavigateToNote(selectedNote.noteId)}
                >
                  開く
                </Button>
              </div>

              <div className="isolation-page__detail-stats">
                <div className="isolation-page__detail-stat">
                  <Text variant="caption">孤立度</Text>
                  <Text variant="body">
                    {Math.round(selectedNote.isolationScore * 100)}%
                  </Text>
                </div>
                <div className="isolation-page__detail-stat">
                  <Text variant="caption">入力エッジ</Text>
                  <Text variant="body">{selectedNote.inDegree}</Text>
                </div>
                <div className="isolation-page__detail-stat">
                  <Text variant="caption">出力エッジ</Text>
                  <Text variant="body">{selectedNote.outDegree}</Text>
                </div>
                <div className="isolation-page__detail-stat">
                  <Text variant="caption">接続度</Text>
                  <Text variant="body">
                    {Math.round(selectedNote.connectivity * 100)}%
                  </Text>
                </div>
              </div>

              <div className="isolation-page__suggestions">
                <Text variant="subtitle">統合候補</Text>
                {suggestionsLoading ? (
                  <div className="isolation-page__suggestions-loading">
                    <Spinner size="sm" />
                  </div>
                ) : suggestions.length === 0 ? (
                  <Text variant="caption">類似ノートが見つかりませんでした</Text>
                ) : (
                  <div className="isolation-page__suggestion-list">
                    {suggestions.map((s) => (
                      <button
                        key={s.noteId}
                        className="isolation-page__suggestion-item"
                        onClick={() => handleNavigateToNote(s.noteId)}
                      >
                        <div className="isolation-page__suggestion-info">
                          <Text variant="body" truncate>
                            {s.title}
                          </Text>
                          <Text variant="caption">{s.reason}</Text>
                        </div>
                        <Badge
                          variant={
                            s.similarity > 0.8
                              ? 'decision'
                              : s.similarity > 0.6
                                ? 'learning'
                                : 'default'
                          }
                        >
                          {Math.round(s.similarity * 100)}%
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
