/**
 * Search ドメイン ディスパッチャー
 */

import * as searchService from "./service";
import { CATEGORIES, type Category } from "../../shared/db/schema";
import { findAllNotes } from "../note";
import {
  validateQuery,
  validateLimitAllowAll,
  validateOptionalEnum,
  validateOptionalArray,
  validateStringLength,
  requireString,
  LIMITS,
} from "../../shared/utils/validation";

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
      case "hybrid":
        return searchService.searchNotesHybrid(query, { category, tags });
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
