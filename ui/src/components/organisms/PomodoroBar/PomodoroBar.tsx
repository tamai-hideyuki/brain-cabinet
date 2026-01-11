import { usePomodoroTimer } from '../../../hooks/usePomodoroTimer'
import './PomodoroBar.css'

export const PomodoroBar = () => {
  const {
    isRunning,
    isBreak,
    formattedTime,
    completedSessions,
    isNotifying,
    start,
    pause,
    reset,
    dismissNotification,
  } = usePomodoroTimer()

  const handleMainClick = () => {
    if (isNotifying) {
      dismissNotification()
    } else if (isRunning) {
      pause()
    } else {
      start()
    }
  }

  return (
    <div
      className={`pomodoro-bar ${isBreak ? 'pomodoro-bar--break' : ''} ${isNotifying ? 'pomodoro-bar--notifying' : ''}`}
    >
      <div className="pomodoro-bar__content">
        <div className="pomodoro-bar__status">
          {isNotifying ? (
            <svg
              className="pomodoro-bar__icon pomodoro-bar__icon--bell"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          ) : (
            <svg
              className="pomodoro-bar__icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          )}
          <span className="pomodoro-bar__label">
            {isNotifying
              ? isBreak
                ? '休憩終了'
                : '作業終了'
              : isRunning
                ? isBreak
                  ? '休憩中'
                  : '作業中'
                : '待機中'}
          </span>
        </div>

        <div className="pomodoro-bar__timer">
          <span className="pomodoro-bar__time">{formattedTime}</span>
        </div>

        <div className="pomodoro-bar__actions">
          <button
            className={`pomodoro-bar__btn ${isRunning ? 'pomodoro-bar__btn--pause' : 'pomodoro-bar__btn--play'}`}
            onClick={handleMainClick}
            aria-label={
              isNotifying
                ? '次のセッションを開始'
                : isRunning
                  ? '一時停止'
                  : '開始'
            }
          >
            {isNotifying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            ) : isRunning ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <button
            className="pomodoro-bar__btn pomodoro-bar__btn--reset"
            onClick={reset}
            aria-label="リセット"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1,4 1,10 7,10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {completedSessions > 0 && (
            <span className="pomodoro-bar__sessions" title={`今日 ${completedSessions} ポモドーロ完了`}>
              {completedSessions}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
