/**
 * Brain Cabinet — Isolation Dispatcher
 *
 * 孤立ノート検出関連のコマンドを処理するディスパッチャー
 */

import * as isolationService from "../services/isolation";

export const isolationDispatcher = {
  /**
   * isolation.detect - 孤立ノートを検出
   *
   * @param threshold - 孤立度の閾値（デフォルト0.7）
   * @param limit - 返すノートの最大数（デフォルト50）
   * @param includeSimilarity - embedding類似度も計算するか（デフォルトtrue）
   */
  async detect(payload: unknown) {
    const p = payload as {
      threshold?: number;
      limit?: number;
      includeSimilarity?: boolean;
    } | undefined;

    return isolationService.detectIsolatedNotes({
      threshold: p?.threshold ?? 0.7,
      limit: p?.limit ?? 50,
      includeSimilarity: p?.includeSimilarity ?? true,
    });
  },

  /**
   * isolation.score - 特定ノートの孤立度を取得
   */
  async score(payload: unknown) {
    const p = payload as { noteId: string };
    if (!p?.noteId) {
      throw new Error("noteId is required");
    }

    const result = await isolationService.getIsolationScore(p.noteId);
    if (!result) {
      throw new Error("Note not found");
    }

    return result;
  },

  /**
   * isolation.stats - 孤立度の統計情報を取得
   */
  async stats(payload: unknown) {
    const p = payload as { threshold?: number } | undefined;
    return isolationService.getIsolationStats(p?.threshold ?? 0.7);
  },

  /**
   * isolation.suggestions - 孤立ノートに対する統合提案を取得
   */
  async suggestions(payload: unknown) {
    const p = payload as { noteId: string; limit?: number };
    if (!p?.noteId) {
      throw new Error("noteId is required");
    }

    return isolationService.getIntegrationSuggestions(
      p.noteId,
      p.limit ?? 5
    );
  },
};
