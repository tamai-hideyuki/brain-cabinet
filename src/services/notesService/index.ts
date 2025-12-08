import {
  findAllNotes,
  updateNoteInDB,
  findNoteById,
  createNoteInDB,
  deleteNoteInDB,
  updateNotesCategoryInDB,
  findNotesByIds,
} from "../../repositories/notesRepo";
import { getHistoryById } from "../historyService";
import { enqueueJob } from "../jobs/job-queue";
import type { Category } from "../../db/schema";

/**
 * JSON文字列を配列にパース（安全に）
 */
const parseJsonArray = (jsonStr: string | null): string[] => {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * DBのノートをAPI用にフォーマット（tags/headingsをパース）
 */
const formatNoteForAPI = (note: {
  id: string;
  title: string;
  path: string;
  content: string;
  tags: string | null;
  category: string | null;
  headings: string | null;
  createdAt: number;
  updatedAt: number;
}) => {
  return {
    ...note,
    tags: parseJsonArray(note.tags),
    headings: parseJsonArray(note.headings),
  };
};

export const getAllNotes = async () => {
  const notes = await findAllNotes();
  return notes.map(formatNoteForAPI);
};

export const getNoteById = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) {
    throw new Error("Note not found");
  }
  return formatNoteForAPI(note);
};

export const createNote = async (title: string, content: string) => {
  if (!title || !content) {
    throw new Error("Title and content are required");
  }
  const note = await createNoteInDB(title, content);

  if (note) {
    // 非同期ジョブをキューに追加（Embedding生成 + Relation構築）
    enqueueJob("NOTE_ANALYZE", {
      noteId: note.id,
      updatedAt: note.updatedAt,
    });
  }

  return note ? formatNoteForAPI(note) : null;
};

export const deleteNote = async (id: string) => {
  // deleteNoteInDBが全関連データ（Embedding, Relations, History, ClusterHistory, InfluenceEdges, FTS）を
  // トランザクション内で一括削除する
  const deleted = await deleteNoteInDB(id);
  if (!deleted) {
    throw new Error("Note not found");
  }

  return formatNoteForAPI(deleted);
};

export const updateNote = async (id: string, newContent: string, newTitle?: string) => {
  // ① 元のノートを取得（履歴用に必要）
  const old = await findNoteById(id);

  if (!old) {
    throw new Error("Note not found");
  }

  // 内容もタイトルも変わっていない場合はスキップ
  const titleChanged = newTitle !== undefined && newTitle !== old.title;
  const contentChanged = old.content !== newContent;
  if (!titleChanged && !contentChanged) {
    return formatNoteForAPI(old);
  }

  // ② 本体を更新（履歴保存はジョブ側でsemantic diffを見て判断）
  const updated = await updateNoteInDB(id, newContent, newTitle);

  if (updated) {
    // 非同期ジョブをキューに追加
    // previousContentを渡すことでsemantic diffを計算
    // v3: previousClusterIdも渡してクラスタ遷移を追跡
    enqueueJob("NOTE_ANALYZE", {
      noteId: updated.id,
      previousContent: contentChanged ? old.content : null,
      previousClusterId: old.clusterId ?? null,
      updatedAt: updated.updatedAt,
    });
  }

  return updated ? formatNoteForAPI(updated) : null;
};

export const revertNote = async (noteId: string, historyId: string) => {
  // 履歴を取得
  const history = await getHistoryById(historyId);
  if (!history) {
    throw new Error("History not found");
  }

  // noteIdが一致するか確認
  if (history.noteId !== noteId) {
    throw new Error("History does not belong to this note");
  }

  // 履歴のcontentに巻き戻す（現在の内容も履歴として保存）
  return await updateNote(noteId, history.content);
};

// -------------------------------------
// バッチ操作
// -------------------------------------

export type BatchDeleteResult = {
  deleted: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
};

/**
 * 複数ノートを一括削除
 */
export const batchDeleteNotes = async (ids: string[]): Promise<BatchDeleteResult> => {
  if (ids.length === 0) {
    return { deleted: 0, failed: 0, errors: [] };
  }

  // 上限チェック（一度に100件まで）
  if (ids.length > 100) {
    throw new Error("Batch delete is limited to 100 notes at a time");
  }

  const result: BatchDeleteResult = {
    deleted: 0,
    failed: 0,
    errors: [],
  };

  for (const id of ids) {
    try {
      const deleted = await deleteNoteInDB(id);
      if (deleted) {
        result.deleted++;
      } else {
        result.failed++;
        result.errors.push({ id, error: "Note not found" });
      }
    } catch (err) {
      result.failed++;
      result.errors.push({
        id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
};

export type BatchUpdateCategoryResult = {
  updated: number;
  notFound: string[];
};

/**
 * 複数ノートのカテゴリを一括変更
 */
export const batchUpdateCategory = async (
  ids: string[],
  category: Category
): Promise<BatchUpdateCategoryResult> => {
  if (ids.length === 0) {
    return { updated: 0, notFound: [] };
  }

  // 上限チェック（一度に100件まで）
  if (ids.length > 100) {
    throw new Error("Batch update is limited to 100 notes at a time");
  }

  // 存在するIDを確認
  const existingNotes = await findNotesByIds(ids);
  const existingIds = new Set(existingNotes.map(n => n.id));
  const notFound = ids.filter(id => !existingIds.has(id));

  // 存在するIDのみ更新
  const idsToUpdate = ids.filter(id => existingIds.has(id));
  if (idsToUpdate.length > 0) {
    await updateNotesCategoryInDB(idsToUpdate, category);
  }

  return {
    updated: idsToUpdate.length,
    notFound,
  };
};
