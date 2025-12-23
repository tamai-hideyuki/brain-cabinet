/**
 * シークレットBOXアイテム サービス
 */

import {
  findAllItems,
  findItemsByFolderId,
  findItemById,
  findItemData,
  findItemThumbnail,
  createItem as createItemRepo,
  updateItem as updateItemRepo,
  deleteItem as deleteItemRepo,
  type SecretBoxItemMeta,
  type CreateSecretBoxItemParams,
} from "../../repositories/secretBoxRepo";
import { validateFileSize, validateMimeType, validateFileName } from "../../utils/validation/secretBox";
import { NotFoundError, ErrorCodes } from "../../utils/errors";

/**
 * 全アイテム取得
 */
export const getAllItems = async (): Promise<SecretBoxItemMeta[]> => {
  return await findAllItems();
};

/**
 * フォルダ内のアイテム取得
 */
export const getItemsByFolder = async (
  folderId: string | null
): Promise<SecretBoxItemMeta[]> => {
  return await findItemsByFolderId(folderId);
};

/**
 * アイテムメタデータ取得
 */
export const getItem = async (id: string): Promise<SecretBoxItemMeta> => {
  const item = await findItemById(id);
  if (!item) {
    throw new NotFoundError("SecretBoxItem", id, ErrorCodes.SECRET_BOX_ITEM_NOT_FOUND);
  }
  return item;
};

/**
 * アイテムデータ取得
 */
export const getItemData = async (
  id: string
): Promise<{ data: Buffer; mimeType: string; size: number }> => {
  const result = await findItemData(id);
  if (!result) {
    throw new NotFoundError("SecretBoxItem", id, ErrorCodes.SECRET_BOX_ITEM_NOT_FOUND);
  }
  return result;
};

/**
 * サムネイル取得
 */
export const getItemThumbnail = async (id: string): Promise<Buffer | null> => {
  const result = await findItemThumbnail(id);
  return result?.thumbnail ?? null;
};

/**
 * アイテム作成（アップロード）
 */
export const uploadItem = async (
  file: File,
  options?: { name?: string; folderId?: string | null }
): Promise<SecretBoxItemMeta> => {
  // バリデーション
  validateFileSize(file.size);
  const itemType = validateMimeType(file.type);
  const name = validateFileName(options?.name || file.name);

  // ファイルデータ読み込み
  const arrayBuffer = await file.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  const params: CreateSecretBoxItemParams = {
    name,
    originalName: file.name,
    type: itemType,
    mimeType: file.type,
    size: file.size,
    data,
    folderId: options?.folderId ?? null,
  };

  return await createItemRepo(params);
};

/**
 * アイテム更新
 */
export const updateItemMeta = async (
  id: string,
  updates: { name?: string; folderId?: string | null; position?: number }
): Promise<SecretBoxItemMeta> => {
  // 名前のバリデーション
  if (updates.name !== undefined) {
    updates.name = validateFileName(updates.name);
  }

  const item = await updateItemRepo(id, updates);
  if (!item) {
    throw new NotFoundError("SecretBoxItem", id, ErrorCodes.SECRET_BOX_ITEM_NOT_FOUND);
  }
  return item;
};

/**
 * アイテム削除
 */
export const removeItem = async (id: string): Promise<SecretBoxItemMeta> => {
  const item = await deleteItemRepo(id);
  if (!item) {
    throw new NotFoundError("SecretBoxItem", id, ErrorCodes.SECRET_BOX_ITEM_NOT_FOUND);
  }
  return item;
};
