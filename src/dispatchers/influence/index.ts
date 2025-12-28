/**
 * Influence ドメイン ディスパッチャー
 */

import * as influenceService from "../../services/influence/influenceService";
import { findSimilarNotes } from "../../services/embeddingService";
import { findNoteById } from "../../repositories/notesRepo";
import type { ExtractPayload } from "../../types/command";

type InfluenceInfluencersPayload = ExtractPayload<"influence.influencers">;
type InfluenceInfluencedPayload = ExtractPayload<"influence.influenced">;
type InfluenceSimilarPayload = { noteId: string; limit?: number };

export const influenceDispatcher = {
  async stats() {
    return influenceService.getInfluenceStats();
  },

  async influencers(payload: unknown) {
    const p = payload as InfluenceInfluencersPayload;
    if (!p?.noteId) {
      throw new Error("noteId is required");
    }
    const limit = p.limit ?? 10;
    return influenceService.getInfluencersOf(p.noteId, limit);
  },

  async influenced(payload: unknown) {
    const p = payload as InfluenceInfluencedPayload;
    if (!p?.noteId) {
      throw new Error("noteId is required");
    }
    const limit = p.limit ?? 10;
    return influenceService.getInfluencedBy(p.noteId, limit);
  },

  /**
   * 類似ノートを取得（Embeddingベース）
   * 影響エッジがない場合のフォールバックとして使用
   */
  async similar(payload: unknown) {
    const p = payload as InfluenceSimilarPayload;
    if (!p?.noteId) {
      throw new Error("noteId is required");
    }
    const limit = p.limit ?? 5;

    try {
      const similarNotes = await findSimilarNotes(p.noteId, limit);

      // ノート情報を取得して返す
      const results = await Promise.all(
        similarNotes.map(async ({ noteId, similarity }) => {
          const note = await findNoteById(noteId);
          return {
            noteId,
            similarity,
            note: note
              ? { id: note.id, title: note.title, clusterId: note.clusterId }
              : null,
          };
        })
      );

      return results.filter((r) => r.note !== null);
    } catch (error) {
      // Embeddingがない場合は空配列を返す
      return [];
    }
  },
};
