import { db } from "../db/client";
import { suggestions } from "../db/schema";
import type { Suggestion, NewSuggestion } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";

const log = pino({ name: "suggestion-service" });

const KNOWLEDGE_API_URL = process.env.KNOWLEDGE_API_URL || "http://localhost:3002";

type ContentType = "argument" | "metric" | "case_summary" | "pros_cons";

interface KnowledgeSearchResult {
  id: string;
  title: string;
  content: string;
  source: string | null;
  category: string | null;
  score: number;
  snippet: string;
}

/**
 * knowledge APIからセマンティック検索して素材を生成
 * 素材 = 論点 / 数値 / 過去事例要約 / 判断軸
 * 完成文やトークスクリプトは生成しない
 */
export async function searchAndCreateSuggestions(
  sessionId: string,
  segmentId: string,
  queryText: string
): Promise<Suggestion[]> {
  try {
    const url = `${KNOWLEDGE_API_URL}/api/notes/search?q=${encodeURIComponent(queryText)}&mode=semantic&limit=5`;
    const res = await fetch(url);

    if (!res.ok) {
      log.warn({ status: res.status }, "Knowledge API search failed");
      return [];
    }

    const data = (await res.json()) as { results: KnowledgeSearchResult[] };
    if (!data.results || data.results.length === 0) return [];

    const created: Suggestion[] = [];

    for (const result of data.results) {
      // スコアが低すぎるものは除外
      if (result.score < 0.3) continue;

      const contentType = classifyContentType(result);
      const content = extractMaterial(result, contentType);

      const suggestion: NewSuggestion = {
        id: uuidv4(),
        sessionId,
        segmentId,
        knowledgeNoteId: result.id,
        contentType,
        content,
        score: result.score,
        acknowledgedAt: null,
        pinnedAt: null,
        createdAt: Date.now(),
      };

      await db.insert(suggestions).values(suggestion);
      created.push(suggestion as Suggestion);
    }

    return created;
  } catch (err) {
    log.error({ err }, "Failed to search knowledge base");
    return [];
  }
}

/**
 * コンテンツタイプを分類（ルールベース）
 * 将来的にはLLMで分類精度を上げられる
 */
function classifyContentType(result: KnowledgeSearchResult): ContentType {
  const text = `${result.title} ${result.content}`.toLowerCase();

  // 数値を含む → metric
  if (/\d+%|\d+万|\d+円|\d+件|\d+倍/.test(text)) return "metric";

  // pros/cons的な表現 → pros_cons
  if (/メリット|デメリット|利点|欠点|一方で|しかし|対して/.test(text)) return "pros_cons";

  // 事例的な表現 → case_summary
  if (/事例|ケース|実績|導入|プロジェクト|〜社|〜では/.test(text)) return "case_summary";

  // デフォルト → argument（論点）
  return "argument";
}

/**
 * 検索結果から素材テキストを抽出
 * 「言葉」ではなく「素材」として返す
 */
function extractMaterial(result: KnowledgeSearchResult, type: ContentType): string {
  const title = result.title;
  const snippet = result.snippet || result.content.slice(0, 200);

  switch (type) {
    case "metric":
      return `[数値] ${title}: ${snippet}`;
    case "pros_cons":
      return `[判断軸] ${title}: ${snippet}`;
    case "case_summary":
      return `[事例] ${title}: ${snippet}`;
    case "argument":
    default:
      return `[論点] ${title}: ${snippet}`;
  }
}

export async function acknowledgeSuggestion(id: string): Promise<void> {
  await db
    .update(suggestions)
    .set({ acknowledgedAt: Date.now() })
    .where(eq(suggestions.id, id));
}

export async function pinSuggestion(id: string): Promise<void> {
  await db
    .update(suggestions)
    .set({ pinnedAt: Date.now() })
    .where(eq(suggestions.id, id));
}

export async function unpinSuggestion(id: string): Promise<void> {
  await db
    .update(suggestions)
    .set({ pinnedAt: null })
    .where(eq(suggestions.id, id));
}
