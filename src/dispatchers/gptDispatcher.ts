/**
 * GPT ドメイン ディスパッチャー
 */

import * as gptService from "../services/gptService";
import * as searchService from "../services/searchService";
import { AppError, ErrorCodes } from "../utils/errors";
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
      throw new AppError(ErrorCodes.SEARCH_QUERY_REQUIRED, "query is required", { field: "query" });
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
      default:
        return searchService.searchNotesHybrid(p.query, options);
    }
  },

  async context(payload: unknown) {
    const p = payload as { noteId?: string } | undefined;
    if (!p?.noteId) {
      throw new AppError(ErrorCodes.VALIDATION_REQUIRED, "noteId is required", { field: "noteId" });
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
