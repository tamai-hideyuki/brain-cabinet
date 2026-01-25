import { Hono } from "hono";
import { searchForGPT } from "../../services/gptService";
import { ValidationError, ErrorCodes } from "../../utils/errors";

export const searchRoute = new Hono();

/**
 * GPT向け複合検索
 * GET /api/gpt/search
 *
 * Query params:
 * - query: 検索クエリ（必須）
 * - searchIn: 検索対象（カンマ区切り、デフォルト: title,content,tags）
 * - category: カテゴリフィルター
 * - limit: 件数制限（デフォルト: 10）
 * - includeHistory: 履歴件数を含める（true/false）
 */
searchRoute.get("/search", async (c) => {
  const query = c.req.query("query");
  if (!query) {
    throw new ValidationError("query is required", "query", ErrorCodes.SEARCH_QUERY_REQUIRED);
  }

  const searchInParam = c.req.query("searchIn");
  const searchIn = searchInParam
    ? (searchInParam.split(",") as ("title" | "content" | "tags" | "headings")[])
    : undefined;

  const category = c.req.query("category");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const includeHistory = c.req.query("includeHistory") === "true";

  const result = await searchForGPT({
    query: decodeURIComponent(query),
    searchIn,
    category,
    limit,
    includeHistory,
  });
  return c.json(result);
});
