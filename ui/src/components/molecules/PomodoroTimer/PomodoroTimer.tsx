import { usePomodoroTimer } from '../../../hooks/usePomodoroTimer'
import './PomodoroTimer.css'

export const PomodoroTimer = () => {
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
      className={`pomodoro ${isBreak ? 'pomodoro--break' : ''} ${isNotifying ? 'pomodoro--notifying' : ''}`}
    >
      <button
        className="pomodoro__main"
        onClick={handleMainClick}
        aria-label={
          isNotifying
            ? '次のセッションを開始'
            : isRunning
              ? 'タイマーを一時停止'
              : 'タイマーを開始'
        }
        title={isBreak ? '休憩中' : '作業中'}
      >
        {isNotifying ? (
          <svg
            className="pomodoro__icon pomodoro__icon--bell"
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
        ) : isRunning ? (
          <svg
            className="pomodoro__icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg
            className="pomodoro__icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
        <span className="pomodoro__time">{formattedTime}</span>
      </button>

      <button
        className="pomodoro__reset"
        onClick={reset}
        aria-label="タイマーをリセット"
        title="リセット"
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
        <span className="pomodoro__sessions" title={`今日 ${completedSessions} ポモドーロ完了`}>
          {completedSessions}
        </span>
      )}
    </div>
  )
}
