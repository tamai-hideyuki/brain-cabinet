/**
 * Search ドメイン ディスパッチャー
 */

import * as searchService from "../../services/searchService";
import { CATEGORIES, type Category } from "../../db/schema";
import { findAllNotes } from "../../repositories/notesRepo";
import {
  validateQuery,
  validateLimitAllowAll,
  validateOptionalEnum,
  validateOptionalArray,
  validateStringLength,
  requireString,
  LIMITS,
} from "../../utils/validation";

const SEARCH_MODES = ["keyword", "semantic", "hybrid"] as const;
type SearchMode = (typeof SEARCH_MODES)[number];

type SearchQueryPayload = {
  query?: string;
  mode?: SearchMode;
  category?: Category;
  tags?: string[];
  limit?: number;
};

type TitleSearchPayload = {
  title?: string;
  exact?: boolean;
  limit?: number;
};

export const searchDispatcher = {
  async query(payload: unknown) {
    const p = payload as SearchQueryPayload | undefined;
    const query = validateQuery(p?.query);
    const mode = validateOptionalEnum(p?.mode, "mode", SEARCH_MODES) ?? "keyword";
    const category = validateOptionalEnum(p?.category, "category", CATEGORIES);
    const tags = validateOptionalArray<string>(p?.tags, "tags", (item, i) =>
      validateStringLength(requireString(item, `tags[${i}]`), `tags[${i}]`, 100)
    );
    const limit = validateLimitAllowAll(p?.limit, LIMITS.LIMIT_DEFAULT);

    const options = {
      category,
      tags,
      limit: limit === 0 ? undefined : limit,
    };

    switch (mode) {
      case "semantic":
        return searchService.searchNotesSemantic(query, options);
      case "hybrid": {
        // ハイブリッド検索: キーワード + セマンティックを組み合わせ
        const [keywordResults, semanticResults] = await Promise.all([
          searchService.searchNotes(query, options),
          searchService.searchNotesSemantic(query, options),
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
        return searchService.searchNotes(query, options);
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
    const title = validateQuery(p?.title, "title");
    const exact = p?.exact ?? false;
    const limit = validateLimitAllowAll(p?.limit, 0);

    const allNotes = await findAllNotes();
    const queryLower = title.toLowerCase();

    let results = allNotes.filter((note) => {
      const noteTitle = note.title.toLowerCase();
      return exact ? noteTitle === queryLower : noteTitle.includes(queryLower);
    });

    // limit適用（0なら全件）
    if (limit > 0) {
      results = results.slice(0, limit);
    }

    return results.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content.slice(0, 200),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));
  },
};
