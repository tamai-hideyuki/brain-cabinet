/**
 * シークレットBOX ツリー構築サービス
 */

import { findAllFolders, findAllItems, type SecretBoxFolder, type SecretBoxItemMeta } from "../../repositories/secretBoxRepo";

// ツリーノード型
export type SecretBoxTreeNode = SecretBoxFolder & {
  children: SecretBoxTreeNode[];
  items: SecretBoxItemMeta[];
};

/**
 * ツリー構造を構築
 */
export const buildTree = async (): Promise<SecretBoxTreeNode[]> => {
  const [folders, items] = await Promise.all([
    findAllFolders(),
    findAllItems(),
  ]);

  // フォルダをIDでマップ化
  const folderMap = new Map<string, SecretBoxTreeNode>();
  folders.forEach((folder) => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
      items: [],
    });
  });

  // アイテムを各フォルダに割り当て
  const rootItems: SecretBoxItemMeta[] = [];
  items.forEach((item) => {
    if (item.folderId && folderMap.has(item.folderId)) {
      folderMap.get(item.folderId)!.items.push(item);
    } else {
      rootItems.push(item);
    }
  });

  // 子フォルダを親に割り当て
  const rootFolders: SecretBoxTreeNode[] = [];
  folderMap.forEach((folder) => {
    if (folder.parentId && folderMap.has(folder.parentId)) {
      folderMap.get(folder.parentId)!.children.push(folder);
    } else {
      rootFolders.push(folder);
    }
  });

  // 各階層をpositionでソート
  const sortByPosition = (nodes: SecretBoxTreeNode[]): SecretBoxTreeNode[] => {
    return nodes.sort((a, b) => a.position - b.position).map((node) => ({
      ...node,
      children: sortByPosition(node.children),
      items: node.items.sort((a, b) => a.position - b.position),
    }));
  };

  // ルートレベルにアイテムも含める疑似フォルダを返すか、
  // またはルートフォルダのみ返すか
  // → ルートフォルダ + ルートアイテムは別々に返す形式にする
  return sortByPosition(rootFolders);
};

/**
 * ルートレベルのアイテムを取得
 */
export const getRootItems = async (): Promise<SecretBoxItemMeta[]> => {
  const items = await findAllItems();
  return items
    .filter((item) => item.folderId === null)
    .sort((a, b) => a.position - b.position);
};

/**
 * 完全なツリー構造（ルートアイテム含む）
 */
export type SecretBoxFullTree = {
  folders: SecretBoxTreeNode[];
  rootItems: SecretBoxItemMeta[];
};

export const getFullTree = async (): Promise<SecretBoxFullTree> => {
  const [folders, rootItems] = await Promise.all([
    buildTree(),
    getRootItems(),
  ]);

  return { folders, rootItems };
};
