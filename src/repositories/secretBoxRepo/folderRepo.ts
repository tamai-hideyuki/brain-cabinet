/**
 * シークレットBOXフォルダ リポジトリ
 */

import { db } from "../../db/client";
import { secretBoxFolders } from "../../db/schema";
import { eq, isNull, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// フォルダ型
export type SecretBoxFolder = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  isExpanded: boolean;
  createdAt: number;
  updatedAt: number;
};

// フォルダ作成パラメータ
export type CreateSecretBoxFolderParams = {
  name: string;
  parentId?: string | null;
};

/**
 * 全フォルダ取得
 */
export const findAllFolders = async (): Promise<SecretBoxFolder[]> => {
  const result = await db
    .select()
    .from(secretBoxFolders)
    .orderBy(secretBoxFolders.position, desc(secretBoxFolders.createdAt));

  return result.map((r) => ({
    ...r,
    isExpanded: r.isExpanded === 1,
  }));
};

/**
 * 子フォルダ取得
 */
export const findFoldersByParentId = async (
  parentId: string | null
): Promise<SecretBoxFolder[]> => {
  const condition = parentId === null
    ? isNull(secretBoxFolders.parentId)
    : eq(secretBoxFolders.parentId, parentId);

  const result = await db
    .select()
    .from(secretBoxFolders)
    .where(condition)
    .orderBy(secretBoxFolders.position, desc(secretBoxFolders.createdAt));

  return result.map((r) => ({
    ...r,
    isExpanded: r.isExpanded === 1,
  }));
};

/**
 * フォルダ取得
 */
export const findFolderById = async (id: string): Promise<SecretBoxFolder | null> => {
  const result = await db
    .select()
    .from(secretBoxFolders)
    .where(eq(secretBoxFolders.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0],
    isExpanded: result[0].isExpanded === 1,
  };
};

/**
 * フォルダ作成
 */
export const createFolder = async (
  params: CreateSecretBoxFolderParams
): Promise<SecretBoxFolder> => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // 同階層の最大positionを取得
  const maxPosResult = await db
    .select({ maxPos: sql<number>`MAX(position)` })
    .from(secretBoxFolders)
    .where(
      params.parentId === null || params.parentId === undefined
        ? isNull(secretBoxFolders.parentId)
        : eq(secretBoxFolders.parentId, params.parentId)
    );
  const position = (maxPosResult[0]?.maxPos ?? -1) + 1;

  await db.insert(secretBoxFolders).values({
    id,
    name: params.name,
    parentId: params.parentId ?? null,
    position,
    isExpanded: 1,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    name: params.name,
    parentId: params.parentId ?? null,
    position,
    isExpanded: true,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * フォルダ更新
 */
export const updateFolder = async (
  id: string,
  updates: {
    name?: string;
    parentId?: string | null;
    position?: number;
    isExpanded?: boolean;
  }
): Promise<SecretBoxFolder | null> => {
  const existing = await findFolderById(id);
  if (!existing) return null;

  const now = Math.floor(Date.now() / 1000);

  await db
    .update(secretBoxFolders)
    .set({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.parentId !== undefined && { parentId: updates.parentId }),
      ...(updates.position !== undefined && { position: updates.position }),
      ...(updates.isExpanded !== undefined && { isExpanded: updates.isExpanded ? 1 : 0 }),
      updatedAt: now,
    })
    .where(eq(secretBoxFolders.id, id));

  return await findFolderById(id);
};

/**
 * フォルダ削除
 */
export const deleteFolder = async (id: string): Promise<SecretBoxFolder | null> => {
  const existing = await findFolderById(id);
  if (!existing) return null;

  await db.delete(secretBoxFolders).where(eq(secretBoxFolders.id, id));

  return existing;
};

/**
 * 子フォルダ数を取得
 */
export const countFoldersByParentId = async (parentId: string): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(secretBoxFolders)
    .where(eq(secretBoxFolders.parentId, parentId));

  return result[0]?.count ?? 0;
};
