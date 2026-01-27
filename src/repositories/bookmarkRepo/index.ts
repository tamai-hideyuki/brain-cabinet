import { db } from "../../db/client";
import { bookmarkNodes, notes, type BookmarkNodeType } from "../../db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";

/**
 * DBから取得した生のブックマークノード行
 */
export type BookmarkNodeRow = {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  noteId: string | null;
  url: string | null;
  position: number;
  isExpanded: number;
  createdAt: number;
  updatedAt: number;
  noteTitle: string | null;
  noteCategory: string | null;
};

/**
 * 全ブックマークノードを取得（notes とJOIN）
 */
export const findAll = async (): Promise<BookmarkNodeRow[]> => {
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

  return rows;
};

/**
 * IDでブックマークノードを取得
 */
export const findById = async (id: string): Promise<BookmarkNodeRow | null> => {
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

  return rows[0] ?? null;
};

/**
 * 同階層の最大positionを取得
 */
export const findMaxPosition = async (parentId: string | null): Promise<number> => {
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
};

/**
 * 子ノードのIDリストを取得
 */
export const findChildrenIds = async (parentId: string): Promise<string[]> => {
  const rows = await db
    .select({ id: bookmarkNodes.id })
    .from(bookmarkNodes)
    .where(eq(bookmarkNodes.parentId, parentId));

  return rows.map((r) => r.id);
};

/**
 * ブックマークノードを挿入
 */
export const insert = async (data: {
  id: string;
  parentId: string | null;
  type: BookmarkNodeType;
  name: string;
  noteId: string | null;
  url: string | null;
  position: number;
  isExpanded: number;
  createdAt: number;
  updatedAt: number;
}): Promise<void> => {
  await db.insert(bookmarkNodes).values(data);
};

/**
 * ブックマークノードを更新
 */
export const update = async (
  id: string,
  data: Partial<{
    name: string;
    parentId: string | null;
    position: number;
    isExpanded: number;
    libraryPosition: string | null;
    libraryColor: string | null;
    updatedAt: number;
  }>
): Promise<void> => {
  await db.update(bookmarkNodes).set(data).where(eq(bookmarkNodes.id, id));
};

/**
 * ブックマークノードを削除
 */
export const deleteById = async (id: string): Promise<void> => {
  await db.delete(bookmarkNodes).where(eq(bookmarkNodes.id, id));
};

/**
 * フォルダ名でノードを検索
 */
export const findFolderByName = async (folderName: string): Promise<{ id: string } | null> => {
  const rows = await db
    .select({ id: bookmarkNodes.id })
    .from(bookmarkNodes)
    .where(and(
      eq(bookmarkNodes.type, "folder"),
      eq(bookmarkNodes.name, folderName)
    ));

  return rows[0] ?? null;
};

/**
 * 全フォルダのライブラリ位置情報を取得
 */
export const findAllFolderPositions = async (): Promise<Array<{
  name: string;
  libraryPosition: string | null;
}>> => {
  return await db
    .select({
      name: bookmarkNodes.name,
      libraryPosition: bookmarkNodes.libraryPosition,
    })
    .from(bookmarkNodes)
    .where(eq(bookmarkNodes.type, "folder"));
};

/**
 * 全フォルダのライブラリ色情報を取得
 */
export const findAllFolderColors = async (): Promise<Array<{
  name: string;
  libraryColor: string | null;
}>> => {
  return await db
    .select({
      name: bookmarkNodes.name,
      libraryColor: bookmarkNodes.libraryColor,
    })
    .from(bookmarkNodes)
    .where(eq(bookmarkNodes.type, "folder"));
};
