import { Hono } from "hono";
import { searchNotes } from "../services/searchService";
import { Category, CATEGORIES } from "../db/schema";

export const searchRoute = new Hono();

searchRoute.get("/", async (c) => {
  let q = c.req.query("query") || "";
  const categoryParam = c.req.query("category");
  const tagsParam = c.req.query("tags");

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

  const results = await searchNotes(q, { category, tags });
  return c.json(results);
});

// カテゴリ一覧を返すエンドポイント
searchRoute.get("/categories", (c) => {
  return c.json(CATEGORIES);
});
