import { useState, useEffect } from 'react'
import { Text } from '../../atoms/Text'
import { Button } from '../../atoms/Button'
import { Spinner } from '../../atoms/Spinner'
import { getSessionsByDate, type SessionDetail } from '../../../api/pomodoroApi'
import './SessionDetailModal.css'

type SessionDetailModalProps = {
  date: string // YYYY-MM-DD
  onClose: () => void
}

const formatTime = (unixSeconds: number): string => {
  const date = new Date(unixSeconds * 1000)
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  return `${mins}分`
}

const formatDateLabel = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export const SessionDetailModal = ({ date, onClose }: SessionDetailModalProps) => {
  const [sessions, setSessions] = useState<SessionDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true)
        const data = await getSessionsByDate(date)
        // completedAtの昇順でソート（古い順）
        setSessions(data.sort((a, b) => a.completedAt - b.completedAt))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    loadSessions()
  }, [date])

  return (
    <div className="session-detail-modal__overlay" onClick={onClose}>
      <div className="session-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="session-detail-modal__header">
          <Text variant="subtitle">{formatDateLabel(date)}の作業</Text>
          <Button variant="secondary" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>

        <div className="session-detail-modal__content">
          {loading ? (
            <div className="session-detail-modal__loading">
              <Spinner size="sm" />
              <Text variant="caption">読み込み中...</Text>
            </div>
          ) : error ? (
            <div className="session-detail-modal__error">
              <Text variant="caption">{error}</Text>
            </div>
          ) : sessions.length === 0 ? (
            <div className="session-detail-modal__empty">
              <Text variant="caption">この日のセッションはありません</Text>
            </div>
          ) : (
            <>
              <div className="session-detail-modal__list">
                {sessions.map((session) => (
                  <div key={session.id} className="session-detail-modal__item">
                    <div className="session-detail-modal__item-time">
                      <Text variant="caption">{formatTime(session.completedAt)}</Text>
                    </div>
                    <div className="session-detail-modal__item-content">
                      <Text variant="body">
                        {session.description || '(作業内容なし)'}
                      </Text>
                      <Text variant="caption">{formatDuration(session.duration)}</Text>
                    </div>
                  </div>
                ))}
              </div>
              <div className="session-detail-modal__summary">
                <Text variant="caption">
                  合計: {sessions.length}セッション
                </Text>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
