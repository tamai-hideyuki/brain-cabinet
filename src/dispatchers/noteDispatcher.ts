/**
 * Note ドメイン ディスパッチャー
 */

import * as notesService from "../services/notesService";
import * as historyService from "../services/historyService";

export const noteDispatcher = {
  async create(payload: unknown) {
    const p = payload as { title?: string; content?: string } | undefined;
    if (!p?.title || !p?.content) {
      throw new Error("title and content are required");
    }
    return notesService.createNote(p.title, p.content);
  },

  async get(payload: unknown) {
    const p = payload as { id?: string } | undefined;
    if (!p?.id) {
      throw new Error("id is required");
    }
    return notesService.getNoteById(p.id);
  },

  async update(payload: unknown) {
    const p = payload as { id?: string; content?: string; title?: string } | undefined;
    if (!p?.id || !p?.content) {
      throw new Error("id and content are required");
    }
    return notesService.updateNote(p.id, p.content, p.title);
  },

  async delete(payload: unknown) {
    const p = payload as { id?: string } | undefined;
    if (!p?.id) {
      throw new Error("id is required");
    }
    return notesService.deleteNote(p.id);
  },

  async list(payload: unknown) {
    const p = payload as { limit?: number; offset?: number } | undefined;
    const notes = await notesService.getAllNotes();
    // limit/offset が指定されていれば適用
    if (p?.limit || p?.offset) {
      const offset = p.offset ?? 0;
      const limit = p.limit ?? notes.length;
      return notes.slice(offset, offset + limit);
    }
    return notes;
  },

  async history(payload: unknown) {
    const p = payload as { id?: string } | undefined;
    if (!p?.id) {
      throw new Error("id is required");
    }
    return historyService.getNoteHistory(p.id);
  },

  async revert(payload: unknown) {
    const p = payload as { noteId?: string; historyId?: string } | undefined;
    if (!p?.noteId || !p?.historyId) {
      throw new Error("noteId and historyId are required");
    }
    return notesService.revertNote(p.noteId, p.historyId);
  },
};
