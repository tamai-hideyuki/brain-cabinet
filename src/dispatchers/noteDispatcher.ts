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
} from "../utils/validation";

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
    const p = payload as { limit?: number; offset?: number } | undefined;
    const notes = await notesService.getAllNotes();
    // limit: 0 で全件取得、未指定も全件取得
    const limit = validateLimitAllowAll(p?.limit, 0);
    const offset = validateOffset(p?.offset);

    if (limit === 0) {
      // 全件取得（offsetのみ適用）
      return notes.slice(offset);
    }
    return notes.slice(offset, offset + limit);
  },

  async history(payload: unknown) {
    const p = payload as { id?: string } | undefined;
    const id = validateId(p?.id);
    return historyService.getNoteHistory(id);
  },

  async revert(payload: unknown) {
    const p = payload as { noteId?: string; historyId?: string } | undefined;
    const noteId = validateId(p?.noteId, "noteId");
    const historyId = validateId(p?.historyId, "historyId");
    return notesService.revertNote(noteId, historyId);
  },
};
