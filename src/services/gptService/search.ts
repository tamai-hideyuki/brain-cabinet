/**
 * GPT向け検索機能
 */

import { searchNotesInDB } from "../../repositories/searchRepo";
import { findHistoryByNoteId } from "../../repositories/historyRepo";
import { normalizeForGPT } from "../../utils/normalize";
import { getLatestInference, classify, getSearchPriority } from "../inference";

// -------------------------------------
// 型定義
// -------------------------------------
export interface GPTSearchOptions {
  query: string;
  searchIn?: ("title" | "content" | "tags" | "headings")[];
  category?: string;
  limit?: number;
  includeHistory?: boolean;
}

export interface GPTSearchResult {
  id: string;
  title: string;
  category: string | null;
  tags: string[];
  headings: string[];
  summary: string;
  relevance: "high" | "medium" | "low";
  updatedAt: number;
  historyCount?: number;
}

export interface GPTSearchWithInferenceResult extends GPTSearchResult {
  noteType?: string;
  intent?: string;
  typeConfidence?: number;
  confidenceDetail?: {
    structural: number;
    experiential: number;
    temporal: number;
  };
  decayProfile?: string;
  searchPriority: number;
}

// -------------------------------------
// GPT向け複合検索
// -------------------------------------
export const searchForGPT = async (options: GPTSearchOptions): Promise<{
  results: GPTSearchResult[];
  totalFound: number;
  searchContext: string;
}> => {
  const {
    query,
    searchIn = ["title", "content", "tags"],
    category,
    limit = 10,
    includeHistory = false,
  } = options;

  const raw = await searchNotesInDB(query, { category: category as any });
  const results: GPTSearchResult[] = [];

  for (const note of raw.slice(0, limit * 2)) {
    const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
    const headings: string[] = note.headings ? JSON.parse(note.headings) : [];
    const q = query.toLowerCase();

    let matchScore = 0;
    if (searchIn.includes("title") && note.title.toLowerCase().includes(q)) {
      matchScore += 3;
    }
    if (searchIn.includes("content") && note.content.toLowerCase().includes(q)) {
      matchScore += 1;
    }
    if (searchIn.includes("tags") && tags.some(t => t.toLowerCase().includes(q))) {
      matchScore += 2;
    }
    if (searchIn.includes("headings") && headings.some(h => h.toLowerCase().includes(q))) {
      matchScore += 2;
    }

    let historyCount: number | undefined;
    if (includeHistory) {
      const histories = await findHistoryByNoteId(note.id);
      historyCount = histories.length;
    }

    const normalizedContent = normalizeForGPT(note.content);
    const summary = normalizedContent.slice(0, 200) + (normalizedContent.length > 200 ? "..." : "");

    let relevance: "high" | "medium" | "low";
    if (matchScore >= 4) relevance = "high";
    else if (matchScore >= 2) relevance = "medium";
    else relevance = "low";

    results.push({
      id: note.id,
      title: note.title,
      category: note.category,
      tags,
      headings,
      summary,
      relevance,
      updatedAt: note.updatedAt,
      historyCount,
    });
  }

  results.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.relevance] - order[a.relevance];
  });

  const searchContext = `
検索クエリ「${query}」で ${results.length} 件のノートが見つかりました。
${category ? `カテゴリ: ${category}` : "全カテゴリ"}
検索対象: ${searchIn.join(", ")}
`.trim();

  return {
    results: results.slice(0, limit),
    totalFound: raw.length,
    searchContext,
  };
};

// -------------------------------------
// GPT向け検索（判断ノートを優先）
// -------------------------------------
export const searchForGPTWithInference = async (
  options: GPTSearchOptions
): Promise<{
  results: GPTSearchWithInferenceResult[];
  totalFound: number;
  searchContext: string;
}> => {
  const baseResult = await searchForGPT(options);
  const resultsWithInference: GPTSearchWithInferenceResult[] = [];

  for (const result of baseResult.results) {
    const inference = await getLatestInference(result.id);

    let searchPriority = 50;

    if (inference) {
      const classification = classify(inference);
      searchPriority = getSearchPriority(
        classification.primaryType,
        classification.reliability
      );
    }

    resultsWithInference.push({
      ...result,
      noteType: inference?.type,
      intent: inference?.intent,
      typeConfidence: inference?.confidence,
      confidenceDetail: inference?.confidenceDetail,
      decayProfile: inference?.decayProfile,
      searchPriority,
    });
  }

  resultsWithInference.sort((a, b) => {
    if (b.searchPriority !== a.searchPriority) {
      return b.searchPriority - a.searchPriority;
    }
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.relevance] - order[a.relevance];
  });

  const decisionCount = resultsWithInference.filter(
    (r) => r.noteType === "decision"
  ).length;
  const learningCount = resultsWithInference.filter(
    (r) => r.noteType === "learning"
  ).length;

  const searchContext = `
検索クエリ「${options.query}」で ${baseResult.totalFound} 件のノートが見つかりました。
${decisionCount > 0 ? `判断ノート: ${decisionCount}件（優先表示）` : ""}
${learningCount > 0 ? `学習ノート: ${learningCount}件` : ""}
${options.category ? `カテゴリ: ${options.category}` : "全カテゴリ"}
`.trim();

  return {
    results: resultsWithInference,
    totalFound: baseResult.totalFound,
    searchContext,
  };
};
