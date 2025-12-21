import { Hono } from "hono";
import { searchNotes, searchNotesSemantic, type SearchResult } from "../../services/searchService";
import { Category, CATEGORIES } from "../../db/schema";
import { logger } from "../../utils/logger";

export const searchRoute = new Hono();

// GET /api/search - 検索
searchRoute.get("/", async (c) => {
  let q = c.req.query("query") || "";
  const categoryParam = c.req.query("category");
  const tagsParam = c.req.query("tags");
  const mode = c.req.query("mode") || "keyword"; // keyword | semantic | hybrid

  // 日本語やemoji検索のため
  q = decodeURIComponent(q);

  // カテゴリバリデーション
  let category: Category | undefined;
  if (categoryParam) {
    const decoded = decodeURIComponent(categoryParam);
    if (CATEGORIES.includes(decoded as Category)) {
      category = decoded as Category;
    }
  }

  // タグ（カンマ区切り）
  let tags: string[] | undefined;
  if (tagsParam) {
    tags = decodeURIComponent(tagsParam)
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // モードに応じた検索
  if (mode === "semantic") {
    const results = await searchNotesSemantic(q, { category, tags });
    return c.json(results);
  }

  if (mode === "hybrid") {
    // キーワード検索と意味検索の両方を実行して統合
    const [keywordResults, semanticResults] = await Promise.all([
      searchNotes(q, { category, tags }),
      searchNotesSemantic(q, { category, tags }).catch((e) => {
        logger.warn({ err: e, query: q }, "Semantic search failed, falling back to keyword only");
        return [];
      }),
    ]);
    const results = mergeSearchResults(keywordResults, semanticResults);
    return c.json(results);
  }

  // デフォルト: キーワード検索
  const results = await searchNotes(q, { category, tags });
  return c.json(results);
});

// GET /api/search/categories - カテゴリ一覧
searchRoute.get("/categories", (c) => {
  return c.json(CATEGORIES);
});

/**
 * キーワード検索と意味検索の結果を統合
 */
const mergeSearchResults = (
  keywordResults: SearchResult[],
  semanticResults: SearchResult[]
): SearchResult[] => {
  const merged = new Map<string, { result: SearchResult; keywordScore: number; semanticScore: number }>();

  // キーワード検索結果を追加
  for (const result of keywordResults) {
    merged.set(result.id, {
      result,
      keywordScore: result.score,
      semanticScore: 0,
    });
  }

  // 意味検索結果を追加/マージ
  for (const result of semanticResults) {
    const existing = merged.get(result.id);
    if (existing) {
      existing.semanticScore = result.score;
    } else {
      merged.set(result.id, {
        result,
        keywordScore: 0,
        semanticScore: result.score,
      });
    }
  }

  // スコアを統合してソート
  return Array.from(merged.values())
    .map(({ result, keywordScore, semanticScore }) => ({
      ...result,
      score: keywordScore * 0.6 + semanticScore * 0.4, // キーワード60% + 意味40%
      _debug: {
        ...result._debug,
        keywordScore,
        semanticScore,
      },
    }))
    .sort((a, b) => b.score - a.score);
};
