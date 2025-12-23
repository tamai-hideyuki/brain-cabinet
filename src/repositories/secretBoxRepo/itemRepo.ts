/**
 * シークレットBOXアイテム リポジトリ
 */

import { db } from "../../db/client";
import { secretBoxItems, type SecretBoxItemType } from "../../db/schema";
import { eq, desc, sql, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

// アイテムメタデータ型（BLOBを除く）
export type SecretBoxItemMeta = {
  id: string;
  name: string;
  originalName: string;
  type: SecretBoxItemType;
  mimeType: string;
  size: number;
  folderId: string | null;
  position: number;
  createdAt: number;
  updatedAt: number;
};

// アイテム作成パラメータ
export type CreateSecretBoxItemParams = {
  name: string;
  originalName: string;
  type: SecretBoxItemType;
  mimeType: string;
  size: number;
  data: Buffer;
  thumbnail?: Buffer | null;
  folderId?: string | null;
};

/**
 * アイテム一覧取得（BLOBを除く）
 */
export const findAllItems = async (): Promise<SecretBoxItemMeta[]> => {
  const result = await db
    .select({
      id: secretBoxItems.id,
      name: secretBoxItems.name,
      originalName: secretBoxItems.originalName,
      type: secretBoxItems.type,
      mimeType: secretBoxItems.mimeType,
      size: secretBoxItems.size,
      folderId: secretBoxItems.folderId,
      position: secretBoxItems.position,
      createdAt: secretBoxItems.createdAt,
      updatedAt: secretBoxItems.updatedAt,
    })
    .from(secretBoxItems)
    .orderBy(desc(secretBoxItems.createdAt));

  return result.map((r) => ({
    ...r,
    type: r.type as SecretBoxItemType,
  }));
};

/**
 * フォルダ内のアイテム取得（BLOBを除く）
 */
export const findItemsByFolderId = async (
  folderId: string | null
): Promise<SecretBoxItemMeta[]> => {
  const condition = folderId === null
    ? isNull(secretBoxItems.folderId)
    : eq(secretBoxItems.folderId, folderId);

  const result = await db
    .select({
      id: secretBoxItems.id,
      name: secretBoxItems.name,
      originalName: secretBoxItems.originalName,
      type: secretBoxItems.type,
      mimeType: secretBoxItems.mimeType,
      size: secretBoxItems.size,
      folderId: secretBoxItems.folderId,
      position: secretBoxItems.position,
      createdAt: secretBoxItems.createdAt,
      updatedAt: secretBoxItems.updatedAt,
    })
    .from(secretBoxItems)
    .where(condition)
    .orderBy(secretBoxItems.position, desc(secretBoxItems.createdAt));

  return result.map((r) => ({
    ...r,
    type: r.type as SecretBoxItemType,
  }));
};

/**
 * アイテムメタデータ取得（BLOBを除く）
 */
export const findItemById = async (id: string): Promise<SecretBoxItemMeta | null> => {
  const result = await db
    .select({
      id: secretBoxItems.id,
      name: secretBoxItems.name,
      originalName: secretBoxItems.originalName,
      type: secretBoxItems.type,
      mimeType: secretBoxItems.mimeType,
      size: secretBoxItems.size,
      folderId: secretBoxItems.folderId,
      position: secretBoxItems.position,
      createdAt: secretBoxItems.createdAt,
      updatedAt: secretBoxItems.updatedAt,
    })
    .from(secretBoxItems)
    .where(eq(secretBoxItems.id, id))
    .limit(1);

  if (result.length === 0) return null;

  return {
    ...result[0],
    type: result[0].type as SecretBoxItemType,
  };
};

/**
 * アイテムデータ取得（BLOBのみ）
 */
export const findItemData = async (
  id: string
): Promise<{ data: Buffer; mimeType: string; size: number } | null> => {
  const result = await db
    .select({
      data: secretBoxItems.data,
      mimeType: secretBoxItems.mimeType,
      size: secretBoxItems.size,
    })
    .from(secretBoxItems)
    .where(eq(secretBoxItems.id, id))
    .limit(1);

  if (result.length === 0 || !result[0].data) return null;

  return {
    data: Buffer.from(result[0].data as ArrayBuffer),
    mimeType: result[0].mimeType,
    size: result[0].size,
  };
};

/**
 * サムネイル取得
 */
export const findItemThumbnail = async (
  id: string
): Promise<{ thumbnail: Buffer } | null> => {
  const result = await db
    .select({
      thumbnail: secretBoxItems.thumbnail,
    })
    .from(secretBoxItems)
    .where(eq(secretBoxItems.id, id))
    .limit(1);

  if (result.length === 0 || !result[0].thumbnail) return null;

  return {
    thumbnail: Buffer.from(result[0].thumbnail as ArrayBuffer),
  };
};

/**
 * アイテム作成
 */
export const createItem = async (
  params: CreateSecretBoxItemParams
): Promise<SecretBoxItemMeta> => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // 同フォルダ内の最大positionを取得
  const maxPosResult = await db
    .select({ maxPos: sql<number>`MAX(position)` })
    .from(secretBoxItems)
    .where(
      params.folderId === null || params.folderId === undefined
        ? isNull(secretBoxItems.folderId)
        : eq(secretBoxItems.folderId, params.folderId)
    );
  const position = (maxPosResult[0]?.maxPos ?? -1) + 1;

  await db.insert(secretBoxItems).values({
    id,
    name: params.name,
    originalName: params.originalName,
    type: params.type,
    mimeType: params.mimeType,
    size: params.size,
    data: params.data,
    thumbnail: params.thumbnail ?? null,
    folderId: params.folderId ?? null,
    position,
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    name: params.name,
    originalName: params.originalName,
    type: params.type,
    mimeType: params.mimeType,
    size: params.size,
    folderId: params.folderId ?? null,
    position,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * アイテム更新（名前・フォルダ・位置）
 */
export const updateItem = async (
  id: string,
  updates: {
    name?: string;
    folderId?: string | null;
    position?: number;
  }
): Promise<SecretBoxItemMeta | null> => {
  const existing = await findItemById(id);
  if (!existing) return null;

  const now = Math.floor(Date.now() / 1000);

  await db
    .update(secretBoxItems)
    .set({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.folderId !== undefined && { folderId: updates.folderId }),
      ...(updates.position !== undefined && { position: updates.position }),
      updatedAt: now,
    })
    .where(eq(secretBoxItems.id, id));

  return await findItemById(id);
};

/**
 * アイテム削除
 */
export const deleteItem = async (id: string): Promise<SecretBoxItemMeta | null> => {
  const existing = await findItemById(id);
  if (!existing) return null;

  await db.delete(secretBoxItems).where(eq(secretBoxItems.id, id));

  return existing;
};

/**
 * フォルダ内のアイテム数を取得
 */
export const countItemsByFolderId = async (folderId: string): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(secretBoxItems)
    .where(eq(secretBoxItems.folderId, folderId));

  return result[0]?.count ?? 0;
};
