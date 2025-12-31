import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Badge } from '../../atoms/Badge'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { fetchNotes, fetchPromotionCandidates } from '../../../api/notesApi'
import { fetchPtmSummary } from '../../../api/ptmApi'
import { fetchIsolatedNotes, type IsolatedNote } from '../../../api/isolationApi'
import type { Note, PromotionCandidate } from '../../../types/note'
import type { PtmSummary } from '../../../types/ptm'
import { WeeklySummarySection } from '../WeeklySummarySection'
import './Dashboard.css'

type DashboardProps = {
  onNoteClick?: (noteId: string) => void
  onReviewClick?: () => void
}

const getModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    exploration: '探索',
    consolidation: '整理',
    refactoring: '再構築',
    rest: '休息',
  }
  return labels[mode] || mode
}

const getSeasonLabel = (season: string): string => {
  const labels: Record<string, string> = {
    deep_focus: '深堀り',
    broad_search: '広探索',
    structuring: '構造化',
    balanced: 'バランス',
  }
  return labels[season] || season
}

const getStateLabel = (state: string): string => {
  const labels: Record<string, string> = {
    stable: '安定',
    overheat: '過熱',
    stagnation: '停滞',
  }
  return labels[state] || state
}

const getStateVariant = (state: string): 'default' | 'decision' | 'learning' => {
  if (state === 'stable') return 'learning'
  if (state === 'overheat') return 'decision'
  return 'default'
}

export const Dashboard = ({ onNoteClick, onReviewClick }: DashboardProps) => {
  const [notes, setNotes] = useState<Note[]>([])
  const [totalNotes, setTotalNotes] = useState<number>(0)
  const [ptm, setPtm] = useState<PtmSummary | null>(null)
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([])
  const [isolatedNotes, setIsolatedNotes] = useState<IsolatedNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [notesResult, ptmData, candidatesData, isolatedData] = await Promise.all([
          fetchNotes(),
          fetchPtmSummary(),
          fetchPromotionCandidates(5),
          fetchIsolatedNotes(0.7, 5).catch(() => []), // エラー時は空配列
        ])
        setNotes(notesResult.notes)
        setTotalNotes(notesResult.total)
        setPtm(ptmData)
        setCandidates(candidatesData)
        setIsolatedNotes(isolatedData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="dashboard__loading">
        <Spinner size="lg" />
        <Text variant="body">読み込み中...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard__error">
        <Text variant="body">{error}</Text>
      </div>
    )
  }

  // 今日の日付（ローカルタイムゾーン）
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // 今日更新されたノート（ローカルタイムゾーンで比較）
  const todayNotes = notes.filter((note) => {
    const noteDate = new Date(note.updatedAt * 1000)
    const noteDateStr = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, '0')}-${String(noteDate.getDate()).padStart(2, '0')}`
    return noteDateStr === todayStr
  })

  // 最近更新されたノート（上位5件）
  const recentNotes = [...notes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5)

  // レビュー待ち（scratchカテゴリのノート）
  const reviewNotes = notes.filter(
    (note) => note.category === 'scratch' || note.category === '一時メモ'
  )

  return (
    <div className="dashboard">
      {/* PTM サマリー */}
      {ptm && (
        <div className="dashboard__section dashboard__ptm">
          <div className="dashboard__section-header">
            <Text variant="subtitle">思考の状態</Text>
            <Badge variant={getStateVariant(ptm.state)}>{getStateLabel(ptm.state)}</Badge>
          </div>
          <div className="dashboard__ptm-grid">
            <div className="dashboard__ptm-item">
              <Text variant="caption">モード</Text>
              <Text variant="body">{getModeLabel(ptm.mode)}</Text>
            </div>
            <div className="dashboard__ptm-item">
              <Text variant="caption">シーズン</Text>
              <Text variant="body">{getSeasonLabel(ptm.season)}</Text>
            </div>
            <div className="dashboard__ptm-item">
              <Text variant="caption">成長角度</Text>
              <Text variant="body">{ptm.growthAngle.toFixed(1)}°</Text>
            </div>
            <div className="dashboard__ptm-item">
              <Text variant="caption">ノート総数</Text>
              <Text variant="body">{totalNotes}</Text>
            </div>
          </div>
          {ptm.coach && (
            <div className="dashboard__coach">
              <Text variant="caption">今日のアドバイス</Text>
              <Text variant="body">{ptm.coach.today}</Text>
              {ptm.coach.warning && (
                <div className="dashboard__coach-warning">
                  <Text variant="caption">{ptm.coach.warning}</Text>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* LLM推論サマリー */}
      <WeeklySummarySection onNoteClick={onNoteClick} />

      {/* 今日の活動 */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <Text variant="subtitle">今日の活動</Text>
          <Text variant="caption">{todayNotes.length}件のノート</Text>
        </div>
        {todayNotes.length > 0 ? (
          <div className="dashboard__note-list">
            {todayNotes.slice(0, 3).map((note) => (
              <button
                key={note.id}
                className="dashboard__note-item"
                onClick={() => onNoteClick?.(note.id)}
              >
                <Text variant="body" truncate>
                  {note.title}
                </Text>
                {note.category && (
                  <Badge variant={note.category === 'decision' ? 'decision' : note.category === 'learning' ? 'learning' : 'default'}>
                    {note.category}
                  </Badge>
                )}
              </button>
            ))}
            {todayNotes.length > 3 && (
              <Text variant="caption">他 {todayNotes.length - 3}件</Text>
            )}
          </div>
        ) : (
          <div className="dashboard__empty">
            <Text variant="caption">今日はまだノートがありません</Text>
          </div>
        )}
      </div>

      {/* レビュー待ち */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <Text variant="subtitle">レビュー待ち</Text>
          <Button variant="secondary" size="sm" onClick={onReviewClick}>
            全て見る
          </Button>
        </div>
        {reviewNotes.length > 0 ? (
          <div className="dashboard__note-list">
            {reviewNotes.slice(0, 3).map((note) => (
              <button
                key={note.id}
                className="dashboard__note-item"
                onClick={() => onNoteClick?.(note.id)}
              >
                <Text variant="body" truncate>
                  {note.title}
                </Text>
                <Text variant="caption">
                  {new Date(note.updatedAt * 1000).toLocaleDateString('ja-JP')}
                </Text>
              </button>
            ))}
            {reviewNotes.length > 3 && (
              <Text variant="caption">他 {reviewNotes.length - 3}件</Text>
            )}
          </div>
        ) : (
          <div className="dashboard__empty">
            <Text variant="caption">レビュー待ちのノートはありません</Text>
          </div>
        )}
      </div>

      {/* 昇格候補 */}
      {candidates.length > 0 && (
        <div className="dashboard__section">
          <div className="dashboard__section-header">
            <Text variant="subtitle">昇格候補</Text>
          </div>
          <div className="dashboard__note-list">
            {candidates.slice(0, 3).map((candidate) => (
              <button
                key={candidate.noteId}
                className="dashboard__note-item"
                onClick={() => onNoteClick?.(candidate.noteId)}
              >
                <div className="dashboard__candidate-info">
                  <Text variant="body" truncate>
                    {candidate.title}
                  </Text>
                  <Text variant="caption">{candidate.reason}</Text>
                </div>
                <Badge variant={candidate.suggestedType === 'decision' ? 'decision' : 'learning'}>
                  → {candidate.suggestedType}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 孤立ノート（未統合の思考） */}
      {isolatedNotes.length > 0 && (
        <div className="dashboard__section dashboard__isolated">
          <div className="dashboard__section-header">
            <Text variant="subtitle">未統合の思考</Text>
            <Text variant="caption">{isolatedNotes.length}件</Text>
          </div>
          <div className="dashboard__note-list">
            {isolatedNotes.slice(0, 3).map((note) => (
              <button
                key={note.noteId}
                className="dashboard__note-item"
                onClick={() => onNoteClick?.(note.noteId)}
              >
                <div className="dashboard__candidate-info">
                  <Text variant="body" truncate>
                    {note.title}
                  </Text>
                  <Text variant="caption">
                    孤立度: {Math.round(note.isolationScore * 100)}%
                  </Text>
                </div>
                {note.category && (
                  <Badge variant="default">{note.category}</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 最近の更新 */}
      <div className="dashboard__section">
        <div className="dashboard__section-header">
          <Text variant="subtitle">最近の更新</Text>
        </div>
        <div className="dashboard__note-list">
          {recentNotes.map((note) => (
            <button
              key={note.id}
              className="dashboard__note-item"
              onClick={() => onNoteClick?.(note.id)}
            >
              <Text variant="body" truncate>
                {note.title}
              </Text>
              <Text variant="caption">
                {new Date(note.updatedAt * 1000).toLocaleDateString('ja-JP', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
