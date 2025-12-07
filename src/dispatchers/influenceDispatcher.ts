/**
 * Influence ドメイン ディスパッチャー
 */

import * as influenceService from "../services/influence/influenceService";
import type { ExtractPayload } from "../types/command";

type InfluenceInfluencersPayload = ExtractPayload<"influence.influencers">;
type InfluenceInfluencedPayload = ExtractPayload<"influence.influenced">;

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
};
