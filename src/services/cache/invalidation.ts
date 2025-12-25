/**
 * v5.12 キャッシュ無効化ヘルパー
 *
 * ノート変更時に関連するキャッシュを無効化
 */

import { invalidate } from "./index";
import { logger } from "../../utils/logger";

/**
 * ノート変更時に分析キャッシュを無効化
 * 全ての分析系キャッシュを無効化する（ノート変更は全分析に影響）
 */
export async function invalidateAnalysisCache(): Promise<void> {
  try {
    const deleted = await invalidate();
    if (deleted > 0) {
      logger.debug({ deleted }, "Analysis cache invalidated");
    }
  } catch (error) {
    // キャッシュ無効化の失敗はログのみ（本処理をブロックしない）
    logger.warn({ error }, "Failed to invalidate analysis cache");
  }
}

/**
 * 特定タイプのキャッシュのみ無効化
 */
export async function invalidateCacheByType(
  keyType: Parameters<typeof invalidate>[0]
): Promise<void> {
  try {
    const deleted = await invalidate(keyType);
    if (deleted > 0) {
      logger.debug({ keyType, deleted }, "Cache invalidated by type");
    }
  } catch (error) {
    logger.warn({ error, keyType }, "Failed to invalidate cache by type");
  }
}
