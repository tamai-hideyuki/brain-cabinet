import type { PtmSummary } from '../../../types/ptm'
import { Text } from '../../atoms/Text'
import './CoachModal.css'

type CoachModalProps = {
  ptm: PtmSummary
  onClose: () => void
}

const getModeLabel = (mode: string): string => {
  switch (mode) {
    case 'exploration':
      return '探索フェーズ'
    case 'consolidation':
      return '統合フェーズ'
    case 'refactoring':
      return '再構成フェーズ'
    case 'rest':
      return '休息フェーズ'
    default:
      return mode
  }
}

const getSeasonLabel = (season: string): string => {
  switch (season) {
    case 'deep_focus':
      return '深い集中期'
    case 'broad_search':
      return '広い探索期'
    case 'structuring':
      return '構造化期'
    case 'balanced':
      return 'バランス期'
    default:
      return season
  }
}

const getStateLabel = (state: string): string => {
  switch (state) {
    case 'stable':
      return '安定'
    case 'overheat':
      return '過熱'
    case 'stagnation':
      return '停滞'
    default:
      return state
  }
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'rising':
      return '↗'
    case 'falling':
      return '↘'
    default:
      return '→'
  }
}

export const CoachModal = ({ ptm, onClose }: CoachModalProps) => {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="coach-modal__backdrop" onClick={handleBackdropClick}>
      <div className="coach-modal">
        <header className="coach-modal__header">
          <Text variant="subtitle">今日の思考状態</Text>
          <button className="coach-modal__close" onClick={onClose} aria-label="閉じる">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="coach-modal__status">
          <div className="coach-modal__status-item">
            <span className="coach-modal__status-label">モード</span>
            <span className={`coach-modal__status-value coach-modal__mode--${ptm.mode}`}>
              {getModeLabel(ptm.mode)}
            </span>
          </div>
          <div className="coach-modal__status-item">
            <span className="coach-modal__status-label">シーズン</span>
            <span className={`coach-modal__status-value coach-modal__season--${ptm.season}`}>
              {getSeasonLabel(ptm.season)}
            </span>
          </div>
          <div className="coach-modal__status-item">
            <span className="coach-modal__status-label">状態</span>
            <span className={`coach-modal__status-value coach-modal__state--${ptm.state}`}>
              {getStateLabel(ptm.state)} {getTrendIcon(ptm.trend)}
            </span>
          </div>
        </div>

        {ptm.coach.warning && (
          <div className="coach-modal__warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{ptm.coach.warning}</span>
          </div>
        )}

        <div className="coach-modal__advice">
          <div className="coach-modal__advice-section">
            <Text variant="caption">今日のアドバイス</Text>
            <Text variant="body">{ptm.coach.today}</Text>
          </div>
          <div className="coach-modal__advice-section">
            <Text variant="caption">明日に向けて</Text>
            <Text variant="body">{ptm.coach.tomorrow}</Text>
          </div>
          <div className="coach-modal__advice-section">
            <Text variant="caption">バランス</Text>
            <Text variant="body">{ptm.coach.balance}</Text>
          </div>
        </div>

        <footer className="coach-modal__footer">
          <Text variant="caption">{ptm.date}</Text>
        </footer>
      </div>
    </div>
  )
}
