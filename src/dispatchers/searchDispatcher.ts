/**
 * Search ドメイン ディスパッチャー
 */

import * as searchService from "../services/searchService";
import { CATEGORIES, type Category } from "../db/schema";
import { findAllNotes } from "../repositories/notesRepo";

type SearchQueryPayload = {
  query?: string;
  mode?: "keyword" | "semantic" | "hybrid";
  category?: Category;
  tags?: string[];
  limit?: number;
};

type TitleSearchPayload = {
  title?: string;
  exact?: boolean;
};

export const searchDispatcher = {
  async query(payload: unknown) {
    const p = payload as SearchQueryPayload | undefined;
    if (!p?.query) {
      throw new Error("query is required");
    }

    const mode = p.mode ?? "keyword";
    const options = {
      category: p.category,
      tags: p.tags,
    };

    switch (mode) {
      case "semantic":
        return searchService.searchNotesSemantic(p.query, options);
      case "hybrid": {
        // ハイブリッド検索: キーワード + セマンティックを組み合わせ
        const [keywordResults, semanticResults] = await Promise.all([
          searchService.searchNotes(p.query, options),
          searchService.searchNotesSemantic(p.query, options),
        ]);
        // スコアで統合
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
      case "keyword":
      default:
        return searchService.searchNotes(p.query, options);
    }
  },

  async categories() {
    return {
      categories: CATEGORIES,
    };
  },

  // タイトル検索（完全一致 or 部分一致）
  async byTitle(payload: unknown) {
    const p = payload as TitleSearchPayload | undefined;
    if (!p?.title) {
      throw new Error("title is required");
    }

    const allNotes = await findAllNotes();
    const query = p.title.toLowerCase();
    const exact = p.exact ?? false;

    const results = allNotes.filter((note) => {
      const noteTitle = note.title.toLowerCase();
      return exact ? noteTitle === query : noteTitle.includes(query);
    });

    return results.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content.slice(0, 200),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));
  },
};
