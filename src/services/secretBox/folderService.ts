/**
 * シークレットBOXフォルダ サービス
 */

import {
  findAllFolders,
  findFoldersByParentId,
  findFolderById,
  createFolder as createFolderRepo,
  updateFolder as updateFolderRepo,
  deleteFolder as deleteFolderRepo,
  countFoldersByParentId,
  type SecretBoxFolder,
  type CreateSecretBoxFolderParams,
} from "../../repositories/secretBoxRepo";
import { countItemsByFolderId } from "../../repositories/secretBoxRepo";
import { validateFileName } from "../../utils/validation/secretBox";
import { NotFoundError, ValidationError, ErrorCodes } from "../../utils/errors";

/**
 * 全フォルダ取得
 */
export const getAllFolders = async (): Promise<SecretBoxFolder[]> => {
  return await findAllFolders();
};

/**
 * 子フォルダ取得
 */
export const getFoldersByParent = async (
  parentId: string | null
): Promise<SecretBoxFolder[]> => {
  return await findFoldersByParentId(parentId);
};

/**
 * フォルダ取得
 */
export const getFolder = async (id: string): Promise<SecretBoxFolder> => {
  const folder = await findFolderById(id);
  if (!folder) {
    throw new NotFoundError("SecretBoxFolder", id, ErrorCodes.SECRET_BOX_FOLDER_NOT_FOUND);
  }
  return folder;
};

/**
 * フォルダ作成
 */
export const createNewFolder = async (
  params: CreateSecretBoxFolderParams
): Promise<SecretBoxFolder> => {
  const name = validateFileName(params.name);

  // 親フォルダの存在確認
  if (params.parentId) {
    const parent = await findFolderById(params.parentId);
    if (!parent) {
      throw new NotFoundError("SecretBoxFolder", params.parentId, ErrorCodes.SECRET_BOX_FOLDER_NOT_FOUND);
    }
  }

  return await createFolderRepo({ name, parentId: params.parentId ?? null });
};

/**
 * フォルダ更新
 */
export const updateFolderMeta = async (
  id: string,
  updates: { name?: string; parentId?: string | null; position?: number; isExpanded?: boolean }
): Promise<SecretBoxFolder> => {
  // 名前のバリデーション
  if (updates.name !== undefined) {
    updates.name = validateFileName(updates.name);
  }

  // 親フォルダの存在確認
  if (updates.parentId !== undefined && updates.parentId !== null) {
    const parent = await findFolderById(updates.parentId);
    if (!parent) {
      throw new NotFoundError("SecretBoxFolder", updates.parentId, ErrorCodes.SECRET_BOX_FOLDER_NOT_FOUND);
    }
    // 自分自身を親にすることはできない
    if (updates.parentId === id) {
      throw new ValidationError(
        "Cannot set folder as its own parent",
        "parentId",
        ErrorCodes.VALIDATION_INVALID_ITEM
      );
    }
  }

  const folder = await updateFolderRepo(id, updates);
  if (!folder) {
    throw new NotFoundError("SecretBoxFolder", id, ErrorCodes.SECRET_BOX_FOLDER_NOT_FOUND);
  }
  return folder;
};

/**
 * フォルダ削除（空の場合のみ）
 */
export const removeFolder = async (id: string): Promise<SecretBoxFolder> => {
  // フォルダの存在確認
  const folder = await findFolderById(id);
  if (!folder) {
    throw new NotFoundError("SecretBoxFolder", id, ErrorCodes.SECRET_BOX_FOLDER_NOT_FOUND);
  }

  // 子フォルダがないか確認
  const childFolderCount = await countFoldersByParentId(id);
  if (childFolderCount > 0) {
    throw new ValidationError(
      "Folder is not empty: contains subfolders",
      "id",
      ErrorCodes.SECRET_BOX_FOLDER_NOT_EMPTY
    );
  }

  // アイテムがないか確認
  const itemCount = await countItemsByFolderId(id);
  if (itemCount > 0) {
    throw new ValidationError(
      "Folder is not empty: contains items",
      "id",
      ErrorCodes.SECRET_BOX_FOLDER_NOT_EMPTY
    );
  }

  const deleted = await deleteFolderRepo(id);
  if (!deleted) {
    throw new NotFoundError("SecretBoxFolder", id, ErrorCodes.SECRET_BOX_FOLDER_NOT_FOUND);
  }
  return deleted;
};
