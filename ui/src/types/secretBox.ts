/**
 * シークレットBOX 型定義
 */

export type SecretBoxItemType = "image" | "video";

// アイテムメタデータ
export type SecretBoxItem = {
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

// フォルダ
export type SecretBoxFolder = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  isExpanded: boolean;
  createdAt: number;
  updatedAt: number;
};

// ツリーノード
export type SecretBoxTreeNode = SecretBoxFolder & {
  children: SecretBoxTreeNode[];
  items: SecretBoxItem[];
};

// 完全ツリー
export type SecretBoxFullTree = {
  folders: SecretBoxTreeNode[];
  rootItems: SecretBoxItem[];
};

// 作成パラメータ
export type CreateSecretBoxFolderParams = {
  name: string;
  parentId?: string | null;
};

export type UpdateSecretBoxItemParams = {
  name?: string;
  folderId?: string | null;
  position?: number;
};

export type UpdateSecretBoxFolderParams = {
  name?: string;
  parentId?: string | null;
  position?: number;
  isExpanded?: boolean;
};
