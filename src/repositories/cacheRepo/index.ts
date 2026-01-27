/**
 * キャッシュRepository
 * analysis_cacheテーブルへのDB操作を集約
 */

import { db } from "../../db/client";
import { analysisCache, CacheKeyType } from "../../db/schema";
import { eq, and, lt } from "drizzle-orm";

export type CacheEntry = {
  id: number;
  cacheKey: string;
  keyType: CacheKeyType;
  data: string;
  ttlSeconds: number;
  createdAt: number;
  expiresAt: number;
};

export type CacheStats = {
  keyType: CacheKeyType;
  data: string;
  expiresAt: number;
};

/**
 * キーとタイプでキャッシュを取得
 */
export const findByKeyAndType = async (
  key: string,
  keyType: CacheKeyType
): Promise<CacheEntry | null> => {
  const result = await db
    .select()
    .from(analysisCache)
    .where(
      and(
        eq(analysisCache.cacheKey, key),
        eq(analysisCache.keyType, keyType)
      )
    )
    .limit(1);

  return (result[0] as CacheEntry) ?? null;
};

/**
 * IDでキャッシュを削除
 */
export const deleteById = async (id: number): Promise<void> => {
  await db.delete(analysisCache).where(eq(analysisCache.id, id));
};

/**
 * キーとタイプでキャッシュを削除
 */
export const deleteByKeyAndType = async (
  key: string,
  keyType: CacheKeyType
): Promise<void> => {
  await db
    .delete(analysisCache)
    .where(
      and(
        eq(analysisCache.cacheKey, key),
        eq(analysisCache.keyType, keyType)
      )
    );
};

/**
 * キャッシュを挿入
 */
export const insert = async (entry: {
  cacheKey: string;
  keyType: CacheKeyType;
  data: string;
  ttlSeconds: number;
  createdAt: number;
  expiresAt: number;
}): Promise<void> => {
  await db.insert(analysisCache).values(entry);
};

/**
 * キータイプで全削除
 */
export const deleteByKeyType = async (keyType: CacheKeyType): Promise<void> => {
  await db.delete(analysisCache).where(eq(analysisCache.keyType, keyType));
};

/**
 * キータイプでカウント
 */
export const countByKeyType = async (keyType: CacheKeyType): Promise<number> => {
  const result = await db
    .select()
    .from(analysisCache)
    .where(eq(analysisCache.keyType, keyType));
  return result.length;
};

/**
 * 全削除
 */
export const deleteAll = async (): Promise<void> => {
  await db.delete(analysisCache);
};

/**
 * 全カウント
 */
export const countAll = async (): Promise<number> => {
  const result = await db.select().from(analysisCache);
  return result.length;
};

/**
 * 期限切れをカウント
 */
export const countExpired = async (now: number): Promise<number> => {
  const result = await db
    .select()
    .from(analysisCache)
    .where(lt(analysisCache.expiresAt, now));
  return result.length;
};

/**
 * 期限切れを削除
 */
export const deleteExpired = async (now: number): Promise<void> => {
  await db.delete(analysisCache).where(lt(analysisCache.expiresAt, now));
};

/**
 * 統計用に全エントリを取得
 */
export const findAllForStats = async (): Promise<CacheStats[]> => {
  return await db
    .select({
      keyType: analysisCache.keyType,
      data: analysisCache.data,
      expiresAt: analysisCache.expiresAt,
    })
    .from(analysisCache) as CacheStats[];
};
