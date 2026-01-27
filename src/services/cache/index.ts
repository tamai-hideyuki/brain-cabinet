/**
 * v5.12 分析キャッシュサービス
 *
 * 重い分析エンドポイントの結果をキャッシュし、パフォーマンスを改善
 * - TTLベースのキャッシュ管理
 * - SQLiteストレージ
 * - データ変更時のキャッシュ無効化
 */

import * as cacheRepo from "../../repositories/cacheRepo";
import { CacheKeyType, CACHE_KEY_TYPES } from "../../db/schema";

// デフォルトTTL設定（秒）
export const DEFAULT_TTL: Record<CacheKeyType, number> = {
  analytics_timescale: 3600,           // 1時間
  analytics_timescale_cluster: 3600,   // 1時間
  influence_causal_summary: 1800,      // 30分
  drift_flows: 1800,                   // 30分
  clusters_quality: 7200,              // 2時間
  gpt_context: 900,                    // 15分
};

/**
 * キャッシュからデータを取得
 * 期限切れの場合はnullを返す
 */
export async function get<T>(
  key: string,
  keyType: CacheKeyType
): Promise<T | null> {
  const now = Math.floor(Date.now() / 1000);

  const cached = await cacheRepo.findByKeyAndType(key, keyType);

  if (!cached) {
    return null;
  }

  // 期限切れチェック
  if (cached.expiresAt < now) {
    // 期限切れデータを削除
    await cacheRepo.deleteById(cached.id);
    return null;
  }

  try {
    return JSON.parse(cached.data) as T;
  } catch {
    // パースエラー時は削除
    await cacheRepo.deleteById(cached.id);
    return null;
  }
}

/**
 * キャッシュにデータを保存
 * 既存のエントリがあれば上書き
 */
export async function set<T>(
  key: string,
  keyType: CacheKeyType,
  data: T,
  ttlSeconds?: number
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = ttlSeconds ?? DEFAULT_TTL[keyType];
  const expiresAt = now + ttl;
  const jsonData = JSON.stringify(data);

  // 既存エントリを削除
  await cacheRepo.deleteByKeyAndType(key, keyType);

  // 新規エントリを挿入
  await cacheRepo.insert({
    cacheKey: key,
    keyType,
    data: jsonData,
    ttlSeconds: ttl,
    createdAt: now,
    expiresAt,
  });
}

/**
 * キャッシュからデータを取得、なければ計算して保存
 */
export async function getOrCompute<T>(
  key: string,
  keyType: CacheKeyType,
  compute: () => Promise<T>,
  ttlSeconds?: number
): Promise<T> {
  // まずキャッシュを確認
  const cached = await get<T>(key, keyType);
  if (cached !== null) {
    return cached;
  }

  // キャッシュにない場合は計算
  const result = await compute();

  // 結果をキャッシュに保存
  await set(key, keyType, result, ttlSeconds);

  return result;
}

/**
 * 特定のキータイプのキャッシュを無効化
 * keyTypeを省略すると全キャッシュを無効化
 */
export async function invalidate(keyType?: CacheKeyType): Promise<number> {
  if (keyType) {
    const count = await cacheRepo.countByKeyType(keyType);

    if (count > 0) {
      await cacheRepo.deleteByKeyType(keyType);
    }
    return count;
  } else {
    const count = await cacheRepo.countAll();

    if (count > 0) {
      await cacheRepo.deleteAll();
    }
    return count;
  }
}

/**
 * 特定のキーのキャッシュを無効化
 */
export async function invalidateKey(
  key: string,
  keyType: CacheKeyType
): Promise<boolean> {
  // 削除前に存在確認
  const existing = await cacheRepo.findByKeyAndType(key, keyType);

  if (!existing) {
    return false;
  }

  await cacheRepo.deleteByKeyAndType(key, keyType);
  return true;
}

/**
 * 期限切れキャッシュを削除（クリーンアップ）
 */
export async function cleanupExpired(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  const count = await cacheRepo.countExpired(now);

  if (count > 0) {
    await cacheRepo.deleteExpired(now);
  }
  return count;
}

/**
 * キャッシュ統計を取得
 */
export async function getStats(): Promise<{
  totalEntries: number;
  entriesByType: Record<CacheKeyType, number>;
  totalSize: number;
  expiredCount: number;
}> {
  const now = Math.floor(Date.now() / 1000);

  // 全エントリを取得
  const entries = await cacheRepo.findAllForStats();

  const entriesByType: Record<CacheKeyType, number> = {} as Record<CacheKeyType, number>;
  for (const type of CACHE_KEY_TYPES) {
    entriesByType[type] = 0;
  }

  let totalSize = 0;
  let expiredCount = 0;

  for (const entry of entries) {
    const keyType = entry.keyType as CacheKeyType;
    entriesByType[keyType] = (entriesByType[keyType] || 0) + 1;
    totalSize += entry.data.length;
    if (entry.expiresAt < now) {
      expiredCount++;
    }
  }

  return {
    totalEntries: entries.length,
    entriesByType,
    totalSize,
    expiredCount,
  };
}

/**
 * キャッシュキーを生成
 * パラメータをソートしてハッシュ化
 */
export function generateCacheKey(
  keyType: CacheKeyType,
  params: Record<string, unknown> = {}
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  const paramString = JSON.stringify(sortedParams);
  return `${keyType}:${paramString}`;
}

// エクスポート（default object形式も提供）
export const CacheService = {
  get,
  set,
  getOrCompute,
  invalidate,
  invalidateKey,
  cleanupExpired,
  getStats,
  generateCacheKey,
  DEFAULT_TTL,
};

export default CacheService;
