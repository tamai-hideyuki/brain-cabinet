/**
 * Note ドメイン ディスパッチャー
 */

import * as notesService from "../services/notesService";
import * as historyService from "../services/historyService";
import {
  validateTitle,
  validateContent,
  validateId,
  validateLimitAllowAll,
  validateOffset,
  validateCategory,
  validateIdArray,
} from "../utils/validation";
import type { Note } from "../types/note";

export const noteDispatcher = {
  async create(payload: unknown) {
    const p = payload as { title?: string; content?: string } | undefined;
    const title = validateTitle(p?.title);
    const content = validateContent(p?.content);
    return notesService.createNote(title, content);
  },

  async get(payload: unknown) {
    const p = payload as { id?: string } | undefined;
    const id = validateId(p?.id);
    return notesService.getNoteById(id);
  },

  async update(payload: unknown) {
    const p = payload as { id?: string; content?: string; title?: string } | undefined;
    const id = validateId(p?.id);
    const content = validateContent(p?.content);
    // titleはオプショナル（更新しない場合もある）
    const title = p?.title ? validateTitle(p.title) : undefined;
    return notesService.updateNote(id, content, title);
  },

  async delete(payload: unknown) {
    const p = payload as { id?: string } | undefined;
    const id = validateId(p?.id);
    return notesService.deleteNote(id);
  },

  async list(payload: unknown) {
    const p = payload as {
      limit?: number;
      offset?: number;
      sort?: "updated" | "created" | "title";
    } | undefined;
    const notes = await notesService.getAllNotes();

    // デフォルト50件（GPTのレスポンスサイズ制限対策）
    // limit: 0 を明示的に指定した場合のみ全件取得
    const limit = p?.limit === 0 ? 0 : validateLimitAllowAll(p?.limit, 50);
    const offset = validateOffset(p?.offset);
    const sort = p?.sort ?? "updated";

    // ソート処理
    let sorted = [...notes];
    if (sort === "updated") {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sort === "created") {
      sorted.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ja"));
    }

    // 軽量化（contentを除外してsnippetに置き換え）
    const formatNote = (note: Note) => ({
      id: note.id,
      title: note.title,
      category: note.category,
      snippet: note.content ? note.content.slice(0, 100) + "..." : "",
      updatedAt: note.updatedAt,
      createdAt: note.createdAt,
    });

    if (limit === 0) {
      // 全件取得（offsetのみ適用）
      const sliced = sorted.slice(offset);
      return {
        total: notes.length,
        returned: sliced.length,
        offset,
        sort,
        notes: sliced.map(formatNote),
      };
    }

    const sliced = sorted.slice(offset, offset + limit);
    return {
      total: notes.length,
      returned: sliced.length,
      limit,
      offset,
      sort,
      notes: sliced.map(formatNote),
    };
  },

  async history(payload: unknown) {
    const p = payload as {
      id?: string;
      limit?: number;
      offset?: number;
      includeContent?: boolean;
      historyId?: string;
    } | undefined;

    // 特定履歴指定がある場合は1件のみ取得
    if (p?.historyId) {
      const historyId = validateId(p.historyId, "historyId");
      return historyService.getSingleHistory(historyId);
    }

    const id = validateId(p?.id);
    const limit = p?.limit ?? 20;
    const offset = p?.offset ?? 0;
    const includeContent = p?.includeContent ?? false;

    return historyService.getNoteHistoryPaginated(id, {
      limit,
      offset,
      includeContent,
    });
  },

  async revert(payload: unknown) {
    const p = payload as { noteId?: string; historyId?: string } | undefined;
    const noteId = validateId(p?.noteId, "noteId");
    const historyId = validateId(p?.historyId, "historyId");
    return notesService.revertNote(noteId, historyId);
  },

  // バッチ操作

  async batchDelete(payload: unknown) {
    const p = payload as { ids?: string[] } | undefined;
    const ids = validateIdArray(p?.ids);
    return notesService.batchDeleteNotes(ids);
  },

  async batchUpdateCategory(payload: unknown) {
    const p = payload as { ids?: string[]; category?: string } | undefined;
    const ids = validateIdArray(p?.ids);
    const category = validateCategory(p?.category);
    return notesService.batchUpdateCategory(ids, category as any);
  },
};
