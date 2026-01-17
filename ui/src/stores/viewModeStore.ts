/**
 * View Mode Store (v7.5)
 *
 * Decision / Execution モード切り替えのためのストア
 *
 * - Decision モード: 判断・意思決定に焦点を当てた表示
 *   - decision, learning ノートを優先表示
 *   - タスク・実行ログは非表示
 *
 * - Execution モード: 実行・タスクに焦点を当てた表示
 *   - scratch, log ノートを優先表示
 *   - 実行中のタスクやログを表示
 */

export type ViewMode = 'decision' | 'execution'

type Listener = (mode: ViewMode) => void

// 現在のモード（localStorageから復元）
let currentMode: ViewMode = (localStorage.getItem('bc-view-mode') as ViewMode) || 'decision'

// 購読者リスト
const listeners: Set<Listener> = new Set()

/**
 * 現在のモードを取得
 */
export function getViewMode(): ViewMode {
  return currentMode
}

/**
 * モードを設定
 */
export function setViewMode(mode: ViewMode): void {
  if (currentMode === mode) return

  currentMode = mode
  localStorage.setItem('bc-view-mode', mode)

  // 購読者に通知
  listeners.forEach((listener) => listener(mode))
}

/**
 * モードをトグル
 */
export function toggleViewMode(): ViewMode {
  const newMode: ViewMode = currentMode === 'decision' ? 'execution' : 'decision'
  setViewMode(newMode)
  return newMode
}

/**
 * モード変更を購読
 * @returns 購読解除関数
 */
export function subscribeToViewMode(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * モードに応じてフィルタリングするカテゴリを取得
 */
export function getFilterCategories(mode: ViewMode): string[] {
  if (mode === 'decision') {
    return ['decision', 'learning']
  }
  return ['scratch', 'log', 'emotion']
}

/**
 * モードに応じて優先表示するカテゴリを取得
 */
export function getPriorityCategories(mode: ViewMode): string[] {
  if (mode === 'decision') {
    return ['decision', 'learning', 'scratch']
  }
  return ['scratch', 'log', 'emotion', 'decision', 'learning']
}
