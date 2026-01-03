import { db } from "../../db/client";
import { bookmarkNodes, type BookmarkNodeType, notes } from "../../db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

// ブックマークノードの型定義
export type BookmarkNode = {
  id: string;
  parentId: string | null;
  type: BookmarkNodeType;
  name: string;
  noteId: string | null;
  url: string | null;
  position: number;
  isExpanded: boolean;
  createdAt: number;
  updatedAt: number;
  // 参照先ノートの情報（type="note"の場合）
  note?: {
    id: string;
    title: string;
    category: string | null;
  } | null;
  // ツリー構築用
  children?: BookmarkNode[];
};

// 全ブックマークノードを取得（フラット）
export async function getAllBookmarkNodes(): Promise<BookmarkNode[]> {
  const rows = await db
    .select({
      id: bookmarkNodes.id,
      parentId: bookmarkNodes.parentId,
      type: bookmarkNodes.type,
      name: bookmarkNodes.name,
      noteId: bookmarkNodes.noteId,
      url: bookmarkNodes.url,
      position: bookmarkNodes.position,
      isExpanded: bookmarkNodes.isExpanded,
      createdAt: bookmarkNodes.createdAt,
      updatedAt: bookmarkNodes.updatedAt,
      noteTitle: notes.title,
      noteCategory: notes.category,
    })
    .from(bookmarkNodes)
    .leftJoin(notes, eq(bookmarkNodes.noteId, notes.id))
    .orderBy(asc(bookmarkNodes.position));

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    type: row.type as BookmarkNodeType,
    name: row.name,
    noteId: row.noteId,
    url: row.url,
    position: row.position,
    isExpanded: row.isExpanded === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    note: row.noteId
      ? {
          id: row.noteId,
          title: row.noteTitle || row.name,
          category: row.noteCategory,
        }
      : null,
  }));
}

// フラットなノードリストをツリー構造に変換
export function buildTree(nodes: BookmarkNode[]): BookmarkNode[] {
  const nodeMap = new Map<string, BookmarkNode>();
  const rootNodes: BookmarkNode[] = [];

  // 全ノードをマップに登録
  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // 親子関係を構築
  nodes.forEach((node) => {
    const current = nodeMap.get(node.id)!;
    if (node.parentId === null) {
      rootNodes.push(current);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(current);
      } else {
        // 親が見つからない場合はルートに追加
        rootNodes.push(current);
      }
    }
  });

  // 各階層をpositionでソート
  const sortChildren = (node: BookmarkNode) => {
    if (node.children) {
      node.children.sort((a, b) => a.position - b.position);
      node.children.forEach(sortChildren);
    }
  };
  rootNodes.sort((a, b) => a.position - b.position);
  rootNodes.forEach(sortChildren);

  return rootNodes;
}

// ブックマークツリーを取得
export async function getBookmarkTree(): Promise<BookmarkNode[]> {
  const nodes = await getAllBookmarkNodes();
  return buildTree(nodes);
}

// 単一ノードを取得
export async function getBookmarkNodeById(id: string): Promise<BookmarkNode | null> {
  const rows = await db
    .select({
      id: bookmarkNodes.id,
      parentId: bookmarkNodes.parentId,
      type: bookmarkNodes.type,
      name: bookmarkNodes.name,
      noteId: bookmarkNodes.noteId,
      url: bookmarkNodes.url,
      position: bookmarkNodes.position,
      isExpanded: bookmarkNodes.isExpanded,
      createdAt: bookmarkNodes.createdAt,
      updatedAt: bookmarkNodes.updatedAt,
      noteTitle: notes.title,
      noteCategory: notes.category,
    })
    .from(bookmarkNodes)
    .leftJoin(notes, eq(bookmarkNodes.noteId, notes.id))
    .where(eq(bookmarkNodes.id, id));

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    parentId: row.parentId,
    type: row.type as BookmarkNodeType,
    name: row.name,
    noteId: row.noteId,
    url: row.url,
    position: row.position,
    isExpanded: row.isExpanded === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    note: row.noteId
      ? {
          id: row.noteId,
          title: row.noteTitle || row.name,
          category: row.noteCategory,
        }
      : null,
  };
}

// 同階層の最大positionを取得
async function getMaxPosition(parentId: string | null): Promise<number> {
  const condition = parentId === null
    ? isNull(bookmarkNodes.parentId)
    : eq(bookmarkNodes.parentId, parentId);

  const rows = await db
    .select({ position: bookmarkNodes.position })
    .from(bookmarkNodes)
    .where(condition)
    .orderBy(asc(bookmarkNodes.position));

  if (rows.length === 0) return -1;
  return Math.max(...rows.map((r) => r.position));
}

// ブックマークノード作成
export async function createBookmarkNode(params: {
  parentId?: string | null;
  type: BookmarkNodeType;
  name: string;
  noteId?: string | null;
  url?: string | null;
}): Promise<BookmarkNode> {
  const id = randomUUID();
  const parentId = params.parentId ?? null;
  const maxPosition = await getMaxPosition(parentId);
  const now = Math.floor(Date.now() / 1000);

  await db.insert(bookmarkNodes).values({
    id,
    parentId,
    type: params.type,
    name: params.name,
    noteId: params.noteId ?? null,
    url: params.url ?? null,
    position: maxPosition + 1,
    isExpanded: 1,
    createdAt: now,
    updatedAt: now,
  });

  const created = await getBookmarkNodeById(id);
  if (!created) throw new Error("Failed to create bookmark node");
  return created;
}

// ブックマークノード更新
export async function updateBookmarkNode(
  id: string,
  params: {
    name?: string;
    parentId?: string | null;
    position?: number;
    isExpanded?: boolean;
  }
): Promise<BookmarkNode> {
  const existing = await getBookmarkNodeById(id);
  if (!existing) throw new Error("Bookmark node not found");

  const now = Math.floor(Date.now() / 1000);
  const updates: Record<string, unknown> = { updatedAt: now };

  if (params.name !== undefined) updates.name = params.name;
  if (params.parentId !== undefined) updates.parentId = params.parentId;
  if (params.position !== undefined) updates.position = params.position;
  if (params.isExpanded !== undefined) updates.isExpanded = params.isExpanded ? 1 : 0;

  await db.update(bookmarkNodes).set(updates).where(eq(bookmarkNodes.id, id));

  const updated = await getBookmarkNodeById(id);
  if (!updated) throw new Error("Failed to update bookmark node");
  return updated;
}

// ブックマークノード削除（子ノードも再帰的に削除）
export async function deleteBookmarkNode(id: string): Promise<void> {
  // 子ノードを取得
  const children = await db
    .select({ id: bookmarkNodes.id })
    .from(bookmarkNodes)
    .where(eq(bookmarkNodes.parentId, id));

  // 子ノードを再帰的に削除
  for (const child of children) {
    await deleteBookmarkNode(child.id);
  }

  // 自身を削除
  await db.delete(bookmarkNodes).where(eq(bookmarkNodes.id, id));
}

// ノードの並び順を更新
export async function reorderBookmarkNodes(
  parentId: string | null,
  orderedIds: string[]
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(bookmarkNodes)
      .set({ position: i, updatedAt: now })
      .where(eq(bookmarkNodes.id, orderedIds[i]));
  }
}

// ノードを別の親に移動
export async function moveBookmarkNode(
  id: string,
  newParentId: string | null,
  newPosition?: number
): Promise<BookmarkNode> {
  // 循環参照チェック
  if (newParentId !== null) {
    const isDescendant = await checkIsDescendant(newParentId, id);
    if (isDescendant) {
      throw new Error("Cannot move a node into its own descendant");
    }
  }

  const maxPosition = await getMaxPosition(newParentId);
  const position = newPosition ?? maxPosition + 1;

  return updateBookmarkNode(id, { parentId: newParentId, position });
}

// targetIdがancestorIdの子孫かどうかをチェック
async function checkIsDescendant(targetId: string, ancestorId: string): Promise<boolean> {
  if (targetId === ancestorId) return true;

  const node = await getBookmarkNodeById(targetId);
  if (!node || node.parentId === null) return false;

  return checkIsDescendant(node.parentId, ancestorId);
}

// ライブラリ3D位置を更新（フォルダ名で検索）
export async function updateLibraryPosition(
  folderName: string,
  position: [number, number, number]
): Promise<{ success: boolean }> {
  const now = Math.floor(Date.now() / 1000);
  const positionJson = JSON.stringify(position);

  // フォルダ名でノードを検索
  const rows = await db
    .select({ id: bookmarkNodes.id })
    .from(bookmarkNodes)
    .where(and(
      eq(bookmarkNodes.type, "folder"),
      eq(bookmarkNodes.name, folderName)
    ));

  if (rows.length === 0) {
    // フォルダが見つからない場合、ルートブックマークとして保存
    // 「ブックマーク」という名前のルートノートを探す or 作成
    if (folderName === "ブックマーク") {
      // ルートレベルのノートはフォルダがないので、特別な処理は不要
      // この場合は保存をスキップ（ルートノートはフォルダではない）
      return { success: true };
    }
    throw new Error(`Folder not found: ${folderName}`);
  }

  await db
    .update(bookmarkNodes)
    .set({ libraryPosition: positionJson, updatedAt: now })
    .where(eq(bookmarkNodes.id, rows[0].id));

  return { success: true };
}

// 全フォルダのライブラリ位置を取得
export async function getLibraryPositions(): Promise<Record<string, [number, number, number]>> {
  const rows = await db
    .select({
      name: bookmarkNodes.name,
      libraryPosition: bookmarkNodes.libraryPosition,
    })
    .from(bookmarkNodes)
    .where(eq(bookmarkNodes.type, "folder"));

  const positions: Record<string, [number, number, number]> = {};

  for (const row of rows) {
    if (row.libraryPosition) {
      try {
        positions[row.name] = JSON.parse(row.libraryPosition);
      } catch {
        // JSONパースエラーは無視
      }
    }
  }

  return positions;
}
