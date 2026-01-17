/**
 * ViewModeToggle Component (v7.5)
 *
 * Decision / Execution モード切り替えトグル
 */

import { useViewMode } from '../../../hooks/useViewMode'
import './ViewModeToggle.css'

type ViewModeToggleProps = {
  compact?: boolean
}

export const ViewModeToggle = ({ compact = false }: ViewModeToggleProps) => {
  const { toggleMode, isDecisionMode } = useViewMode()

  return (
    <div className={`view-mode-toggle ${compact ? 'view-mode-toggle--compact' : ''}`}>
      <button
        className="view-mode-toggle__button"
        onClick={toggleMode}
        aria-label={`モード切り替え: 現在${isDecisionMode ? '判断' : '実行'}モード`}
        title={isDecisionMode ? '実行モードに切り替え' : '判断モードに切り替え'}
      >
        <div className="view-mode-toggle__track">
          <div
            className={`view-mode-toggle__thumb ${isDecisionMode ? 'view-mode-toggle__thumb--decision' : 'view-mode-toggle__thumb--execution'}`}
          />
        </div>
        <div className="view-mode-toggle__labels">
          <span
            className={`view-mode-toggle__label ${isDecisionMode ? 'view-mode-toggle__label--active' : ''}`}
          >
            {compact ? (
              <span className="view-mode-toggle__icon">💡</span>
            ) : (
              <>
                <span className="view-mode-toggle__icon">💡</span>
                <span className="view-mode-toggle__text">判断</span>
              </>
            )}
          </span>
          <span
            className={`view-mode-toggle__label ${!isDecisionMode ? 'view-mode-toggle__label--active' : ''}`}
          >
            {compact ? (
              <span className="view-mode-toggle__icon">⚡</span>
            ) : (
              <>
                <span className="view-mode-toggle__icon">⚡</span>
                <span className="view-mode-toggle__text">実行</span>
              </>
            )}
          </span>
        </div>
      </button>
      {!compact && (
        <p className="view-mode-toggle__hint">
          {isDecisionMode
            ? '判断・学習ノートを優先表示'
            : '実行ログ・タスクを優先表示'}
        </p>
      )}
    </div>
  )
}
