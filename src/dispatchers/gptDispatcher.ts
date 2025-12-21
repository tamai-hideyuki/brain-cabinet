/**
 * GPT ドメイン ディスパッチャー
 */

import * as gptService from "../services/gptService";
import * as searchService from "../services/searchService";
import type { SearchResult } from "../services/searchService";
import { AppError, ErrorCodes } from "../utils/errors";
import type { Category } from "../db/schema";

type GptSearchPayload = {
  query?: string;
  mode?: "keyword" | "semantic" | "hybrid";
  category?: Category;
  tags?: string[];
  limit?: number;
  sort?: "relevance" | "updated" | "created";  // ソート順
};

interface HybridSearchResult extends SearchResult {
  hybridScore?: number;
}

// GPT向けに軽量な検索結果を生成（content全文ではなくsnippetのみ）
const formatForGPT = (results: HybridSearchResult[], limit: number) => {
  return results.slice(0, limit).map(note => ({
    id: note.id,
    title: note.title,
    category: note.category,
    snippet: note.snippet || (note.content ? note.content.slice(0, 200) + "..." : ""),
    score: note.score ?? note.hybridScore,
    updatedAt: note.updatedAt,
    createdAt: note.createdAt,
  }));
};

export const gptDispatcher = {
  async search(payload: unknown) {
    const p = payload as GptSearchPayload | undefined;
    if (!p?.query) {
      throw new AppError(ErrorCodes.SEARCH_QUERY_REQUIRED, "query is required", { field: "query" });
    }

    const mode = p.mode ?? "hybrid";
    const limit = p.limit ?? 20;  // デフォルト20件
    const sort = p.sort ?? "relevance";  // デフォルトは関連度順
    const options = {
      category: p.category,
      tags: p.tags,
    };

    // GPT向けに最適化した検索結果を返す
    let results: HybridSearchResult[];
    switch (mode) {
      case "semantic":
        results = await searchService.searchNotesSemantic(p.query, options);
        break;
      case "keyword":
        results = await searchService.searchNotes(p.query, options);
        break;
      case "hybrid":
      default:
        results = await searchService.searchNotesHybrid(p.query, options);
        break;
    }

    // ソート処理
    if (sort === "updated") {
      results.sort((a, b) => b.updatedAt - a.updatedAt);
    } else if (sort === "created") {
      results.sort((a, b) => b.createdAt - a.createdAt);
    }
    // "relevance"の場合はそのまま（既にスコア順）

    // GPT向けに軽量化して返す
    return {
      query: p.query,
      mode,
      sort,
      totalFound: results.length,
      results: formatForGPT(results, limit),
    };
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

  async coachDecision(payload: unknown) {
    const p = payload as { query?: string } | undefined;
    if (!p?.query) {
      throw new AppError(ErrorCodes.VALIDATION_REQUIRED, "query is required", { field: "query" });
    }
    return gptService.coachDecision(p.query);
  },
};
