/**
 * シークレットBOX APIクライアント
 */

import type {
  SecretBoxItem,
  SecretBoxFolder,
  SecretBoxFullTree,
  CreateSecretBoxFolderParams,
  UpdateSecretBoxItemParams,
  UpdateSecretBoxFolderParams,
} from '../types/secretBox';
import { fetchWithAuth } from './client';

const API_BASE = '/api/secret-box';

/**
 * ツリー構造取得
 */
export const fetchSecretBoxTree = async (): Promise<SecretBoxFullTree> => {
  const res = await fetchWithAuth(API_BASE);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to fetch secret box tree');
  }
  return res.json();
};

/**
 * アイテム一覧取得
 */
export const fetchSecretBoxItems = async (folderId?: string | null): Promise<SecretBoxItem[]> => {
  const params = new URLSearchParams();
  if (folderId !== undefined) {
    params.set('folderId', folderId === null ? 'null' : folderId);
  }
  const url = `${API_BASE}/items${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to fetch items');
  }
  return res.json();
};

/**
 * アイテムアップロード
 */
export const uploadSecretBoxItem = async (
  file: File,
  name?: string,
  folderId?: string | null
): Promise<SecretBoxItem> => {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  if (folderId !== undefined) {
    formData.append('folderId', folderId === null ? 'null' : folderId);
  }

  const res = await fetchWithAuth(`${API_BASE}/items`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to upload item');
  }
  return res.json();
};

/**
 * アイテム更新
 */
export const updateSecretBoxItem = async (
  id: string,
  params: UpdateSecretBoxItemParams
): Promise<SecretBoxItem> => {
  const res = await fetchWithAuth(`${API_BASE}/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to update item');
  }
  return res.json();
};

/**
 * アイテム削除
 */
export const deleteSecretBoxItem = async (id: string): Promise<void> => {
  const res = await fetchWithAuth(`${API_BASE}/items/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to delete item');
  }
};

/**
 * アイテムデータURL取得
 */
export const getSecretBoxItemDataUrl = (id: string): string => {
  return `${API_BASE}/items/${id}/data`;
};

/**
 * サムネイルURL取得
 */
export const getSecretBoxItemThumbnailUrl = (id: string): string => {
  return `${API_BASE}/items/${id}/thumbnail`;
};

/**
 * フォルダ一覧取得
 */
export const fetchSecretBoxFolders = async (parentId?: string | null): Promise<SecretBoxFolder[]> => {
  const params = new URLSearchParams();
  if (parentId !== undefined) {
    params.set('parentId', parentId === null ? 'null' : parentId);
  }
  const url = `${API_BASE}/folders${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to fetch folders');
  }
  return res.json();
};

/**
 * フォルダ作成
 */
export const createSecretBoxFolder = async (
  params: CreateSecretBoxFolderParams
): Promise<SecretBoxFolder> => {
  const res = await fetchWithAuth(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to create folder');
  }
  return res.json();
};

/**
 * フォルダ更新
 */
export const updateSecretBoxFolder = async (
  id: string,
  params: UpdateSecretBoxFolderParams
): Promise<SecretBoxFolder> => {
  const res = await fetchWithAuth(`${API_BASE}/folders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to update folder');
  }
  return res.json();
};

/**
 * フォルダ削除
 */
export const deleteSecretBoxFolder = async (id: string): Promise<void> => {
  const res = await fetchWithAuth(`${API_BASE}/folders/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'Failed to delete folder');
  }
};

/**
 * ファイルサイズをフォーマット
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};
