/**
 * データ変更イベントストア
 *
 * データ変更（ノート作成/更新/削除など）を検知し、
 * 購読者に通知するためのシンプルなイベントバス
 */

type Listener = () => void

// 購読者リスト
const listeners: Set<Listener> = new Set()

// 最終変更タイムスタンプ
let lastChangeTimestamp = 0

/**
 * データ変更を通知
 * 変更系コマンド実行後に呼び出される
 */
export function notifyDataChange(): void {
  lastChangeTimestamp = Date.now()
  listeners.forEach((listener) => listener())
}

/**
 * データ変更イベントを購読
 * @returns 購読解除関数
 */
export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 最終変更タイムスタンプを取得
 */
export function getLastChangeTimestamp(): number {
  return lastChangeTimestamp
}

/**
 * アクションがデータ変更を伴うかどうかを判定
 */
export function isMutatingAction(action: string): boolean {
  const mutatingPatterns = [
    // ノート関連
    'note.create',
    'note.update',
    'note.delete',
    'note.restore',
    // クラスタ関連
    'cluster.create',
    'cluster.update',
    'cluster.delete',
    // ブックマーク関連
    'bookmark.create',
    'bookmark.update',
    'bookmark.delete',
    'bookmark.move',
    'bookmark.reorder',
    // レビュー関連
    'review.submit',
    'review.schedule',
    'review.cancel',
    // LLM推論関連
    'llmInference.execute',
    'llmInference.approve',
    'llmInference.override',
    // システム関連
    'system.rebuildFts',
  ]

  return mutatingPatterns.some((pattern) => action.startsWith(pattern))
}
