/**
 * GPT ドメイン ディスパッチャー
 */

import * as gptService from "../services/gptService";
import * as searchService from "../services/searchService";
import type { Category } from "../db/schema";

type GptSearchPayload = {
  query?: string;
  mode?: "keyword" | "semantic" | "hybrid";
  category?: Category;
  tags?: string[];
  limit?: number;
};

export const gptDispatcher = {
  async search(payload: unknown) {
    const p = payload as GptSearchPayload | undefined;
    if (!p?.query) {
      throw new Error("query is required");
    }

    const mode = p.mode ?? "hybrid";
    const options = {
      category: p.category,
      tags: p.tags,
    };

    // GPT向けに最適化した検索結果を返す
    switch (mode) {
      case "semantic":
        return searchService.searchNotesSemantic(p.query, options);
      case "keyword":
        return searchService.searchNotes(p.query, options);
      case "hybrid":
      default: {
        // ハイブリッド検索
        const [keywordResults, semanticResults] = await Promise.all([
          searchService.searchNotes(p.query, options),
          searchService.searchNotesSemantic(p.query, options),
        ]);
        const merged = new Map<string, { note: unknown; score: number }>();
        for (const note of keywordResults as Array<{ id: string; score: number }>) {
          merged.set(note.id, { note, score: note.score * 0.6 });
        }
        for (const note of semanticResults as Array<{ id: string; score: number }>) {
          const existing = merged.get(note.id);
          if (existing) {
            existing.score += note.score * 0.4;
          } else {
            merged.set(note.id, { note, score: note.score * 0.4 });
          }
        }
        return Array.from(merged.values())
          .sort((a, b) => b.score - a.score)
          .map((item) => item.note);
      }
    }
  },

  async context(payload: unknown) {
    const p = payload as { noteId?: string } | undefined;
    if (!p?.noteId) {
      throw new Error("noteId is required");
    }
    return gptService.getContextForGPT(p.noteId);
  },

  async task() {
    // 思考パターン分析に基づくタスク推奨
    return gptService.generateTaskRecommendations();
  },

  async overview() {
    return gptService.getNotesOverviewForGPT();
  },
};
