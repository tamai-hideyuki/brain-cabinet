import { useState } from 'react'
import type { PtmSummary, ThinkingMode, ThinkingSeason, DriftState } from '../../../types/ptm'
import { CoachModal } from './CoachModal'
import './PTMIndicator.css'

type PTMIndicatorProps = {
  ptm: PtmSummary | null
  loading: boolean
}

const getModeIcon = (mode: ThinkingMode) => {
  switch (mode) {
    case 'exploration':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      )
    case 'consolidation':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M2 12h20" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
    case 'refactoring':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      )
    case 'rest':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )
  }
}

const getSeasonIcon = (season: ThinkingSeason) => {
  switch (season) {
    case 'deep_focus':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'broad_search':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )
    case 'structuring':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      )
    case 'balanced':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18M3 12h18" />
        </svg>
      )
  }
}

const getStateIcon = (state: DriftState) => {
  switch (state) {
    case 'stable':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    case 'overheat':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
      )
    case 'stagnation':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )
  }
}

const getModeLabel = (mode: ThinkingMode): string => {
  switch (mode) {
    case 'exploration':
      return '探索'
    case 'consolidation':
      return '統合'
    case 'refactoring':
      return '再構成'
    case 'rest':
      return '休息'
  }
}

const getSeasonLabel = (season: ThinkingSeason): string => {
  switch (season) {
    case 'deep_focus':
      return '集中'
    case 'broad_search':
      return '拡散'
    case 'structuring':
      return '構造化'
    case 'balanced':
      return 'バランス'
  }
}

const getStateLabel = (state: DriftState): string => {
  switch (state) {
    case 'stable':
      return '安定'
    case 'overheat':
      return '過熱'
    case 'stagnation':
      return '停滞'
  }
}

export const PTMIndicator = ({ ptm, loading }: PTMIndicatorProps) => {
  const [showModal, setShowModal] = useState(false)

  if (loading) {
    return (
      <div className="ptm-indicator ptm-indicator--loading">
        <div className="ptm-indicator__skeleton" />
      </div>
    )
  }

  if (!ptm) {
    return null
  }

  return (
    <>
      <button
        className="ptm-indicator"
        onClick={() => setShowModal(true)}
        title="今日の思考状態"
      >
        <span className={`ptm-indicator__item ptm-indicator__mode ptm-indicator__mode--${ptm.mode}`}>
          {getModeIcon(ptm.mode)}
          <span className="ptm-indicator__label">{getModeLabel(ptm.mode)}</span>
        </span>
        <span className={`ptm-indicator__item ptm-indicator__season ptm-indicator__season--${ptm.season}`}>
          {getSeasonIcon(ptm.season)}
          <span className="ptm-indicator__label">{getSeasonLabel(ptm.season)}</span>
        </span>
        <span className={`ptm-indicator__item ptm-indicator__state ptm-indicator__state--${ptm.state}`}>
          {getStateIcon(ptm.state)}
          <span className="ptm-indicator__label">{getStateLabel(ptm.state)}</span>
        </span>
      </button>
      {showModal && (
        <CoachModal ptm={ptm} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
