/**
 * GPT連携サービス
 * - GPTが使いやすい形式でデータを提供
 * - 複合検索
 * - コンテキスト抽出
 */

import { searchNotesInDB } from "../repositories/searchRepo";
import { findNoteById, findAllNotes } from "../repositories/notesRepo";
import { findHistoryByNoteId } from "../repositories/historyRepo";
import { normalizeMarkdown, formatForGPT, extractOutline, extractBulletPoints } from "../utils/markdown";
import { normalizeForGPT } from "../utils/normalize";

// -------------------------------------
// GPT向け複合検索
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
  summary: string;           // 先頭200文字の要約
  relevance: "high" | "medium" | "low";
  updatedAt: number;
  historyCount?: number;
}

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

  // 基本検索を実行
  const raw = await searchNotesInDB(query, { category: category as any });

  // スコアリングと整形
  const results: GPTSearchResult[] = [];

  for (const note of raw.slice(0, limit * 2)) { // 多めに取得してフィルタ
    const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
    const headings: string[] = note.headings ? JSON.parse(note.headings) : [];
    const q = query.toLowerCase();

    // 検索対象でのマッチ判定
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

    // 履歴数を取得
    let historyCount: number | undefined;
    if (includeHistory) {
      const histories = await findHistoryByNoteId(note.id);
      historyCount = histories.length;
    }

    // 要約生成（先頭200文字、正規化済み）
    const normalizedContent = normalizeForGPT(note.content);
    const summary = normalizedContent.slice(0, 200) + (normalizedContent.length > 200 ? "..." : "");

    // 関連度判定
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

  // 関連度順にソート
  results.sort((a, b) => {
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.relevance] - order[a.relevance];
  });

  // 検索コンテキスト（GPTへの説明）
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
// GPT向けコンテキスト抽出
// -------------------------------------
export interface GPTContextOptions {
  includeFullContent?: boolean;   // 全文を含めるか
  includeHistory?: boolean;       // 履歴を含めるか
  historyLimit?: number;          // 履歴の件数制限
  includeOutline?: boolean;       // アウトラインを含めるか
  includeBulletPoints?: boolean;  // 箇条書きを含めるか
}

export interface GPTContext {
  note: {
    id: string;
    title: string;
    category: string | null;
    tags: string[];
    headings: string[];
    createdAt: number;
    updatedAt: number;
  };
  content: {
    full?: string;           // 正規化済み全文
    outline?: string[];      // 見出し構造
    bulletPoints?: string[]; // 箇条書き一覧
    summary: string;         // 要約（先頭300文字）
  };
  history?: {
    count: number;
    recent: {
      id: string;
      createdAt: number;
      summary: string;       // 変更前の要約
    }[];
  };
  gptInstruction: string;    // GPTへの指示
}

export const getContextForGPT = async (
  noteId: string,
  options: GPTContextOptions = {}
): Promise<GPTContext> => {
  const {
    includeFullContent = true,
    includeHistory = true,
    historyLimit = 3,
    includeOutline = true,
    includeBulletPoints = false,
  } = options;

  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error("Note not found");
  }

  const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
  const headings: string[] = note.headings ? JSON.parse(note.headings) : [];

  // コンテンツ処理
  const normalizedContent = normalizeMarkdown(note.content);
  const gptFormattedContent = formatForGPT(note.content);
  const summary = normalizeForGPT(note.content).slice(0, 300) + "...";

  const content: GPTContext["content"] = { summary };

  if (includeFullContent) {
    content.full = gptFormattedContent;
  }
  if (includeOutline) {
    content.outline = extractOutline(note.content);
  }
  if (includeBulletPoints) {
    content.bulletPoints = extractBulletPoints(note.content);
  }

  // 履歴処理
  let history: GPTContext["history"];
  if (includeHistory) {
    const allHistories = await findHistoryByNoteId(noteId);
    const recentHistories = allHistories.slice(0, historyLimit);

    history = {
      count: allHistories.length,
      recent: recentHistories.map((h) => ({
        id: h.id,
        createdAt: h.createdAt,
        summary: normalizeForGPT(h.content).slice(0, 100) + "...",
      })),
    };
  }

  // GPTへの指示文
  const gptInstruction = `
このノートは「${note.title}」というタイトルで、カテゴリは「${note.category || "未分類"}」です。
${tags.length > 0 ? `関連タグ: ${tags.join(", ")}` : "タグなし"}
${headings.length > 0 ? `主な見出し: ${headings.slice(0, 5).join(", ")}` : ""}
${history ? `${history.count}件の編集履歴があります。` : ""}
`.trim();

  return {
    note: {
      id: note.id,
      title: note.title,
      category: note.category,
      tags,
      headings,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    content,
    history,
    gptInstruction,
  };
};

// -------------------------------------
// GPT To-Do連携
// -------------------------------------
export type GPTTaskType =
  | "extract_key_points"      // 要点抽出
  | "summarize"               // 要約生成
  | "generate_ideas"          // アイデア生成
  | "find_related"            // 関連ノート検索
  | "compare_versions"        // バージョン比較
  | "create_outline";         // アウトライン作成

export interface GPTTaskRequest {
  type: GPTTaskType;
  noteId?: string;
  query?: string;
  options?: Record<string, any>;
}

export interface GPTTaskResponse {
  type: GPTTaskType;
  instruction: string;        // GPTへの指示
  context: string;            // コンテキスト情報
  suggestedPrompt: string;    // 推奨プロンプト
  relatedNoteIds?: string[];  // 関連ノートID
}

export const prepareGPTTask = async (request: GPTTaskRequest): Promise<GPTTaskResponse> => {
  const { type, noteId, query, options } = request;

  switch (type) {
    case "extract_key_points": {
      if (!noteId) throw new Error("noteId is required");
      const ctx = await getContextForGPT(noteId, { includeBulletPoints: true });
      return {
        type,
        instruction: "以下のノートから要点を抽出してください。",
        context: ctx.content.full || ctx.content.summary,
        suggestedPrompt: `「${ctx.note.title}」の要点を箇条書きで5-7個抽出してください。`,
        relatedNoteIds: [noteId],
      };
    }

    case "summarize": {
      if (!noteId) throw new Error("noteId is required");
      const ctx = await getContextForGPT(noteId);
      return {
        type,
        instruction: "以下のノートを要約してください。",
        context: ctx.content.full || ctx.content.summary,
        suggestedPrompt: `「${ctx.note.title}」を3-5文で要約してください。重要なポイントを漏らさないでください。`,
        relatedNoteIds: [noteId],
      };
    }

    case "generate_ideas": {
      if (!noteId) throw new Error("noteId is required");
      const ctx = await getContextForGPT(noteId);

      // 関連ノートを検索
      const related = await searchForGPT({
        query: ctx.note.title,
        limit: 5,
      });

      return {
        type,
        instruction: "このノートを参考にアイデアを生成してください。",
        context: `
## 元ノート
${ctx.content.summary}

## 関連ノート
${related.results.map(r => `- ${r.title}: ${r.summary.slice(0, 50)}...`).join("\n")}
`.trim(),
        suggestedPrompt: `「${ctx.note.title}」の内容を発展させて、新しいアイデアを3つ提案してください。`,
        relatedNoteIds: [noteId, ...related.results.map(r => r.id)],
      };
    }

    case "find_related": {
      const searchQuery = query || (noteId ? (await findNoteById(noteId))?.title : "");
      if (!searchQuery) throw new Error("query or noteId is required");

      const results = await searchForGPT({
        query: searchQuery,
        limit: 10,
        includeHistory: true,
      });

      return {
        type,
        instruction: "関連するノートを見つけました。",
        context: results.results.map(r =>
          `【${r.relevance}】${r.title} [${r.category || "未分類"}] - ${r.summary.slice(0, 50)}...`
        ).join("\n"),
        suggestedPrompt: `「${searchQuery}」に関連するこれらのノートの共通点と相違点を分析してください。`,
        relatedNoteIds: results.results.map(r => r.id),
      };
    }

    case "compare_versions": {
      if (!noteId) throw new Error("noteId is required");
      const ctx = await getContextForGPT(noteId, { includeHistory: true, historyLimit: 5 });

      if (!ctx.history || ctx.history.count === 0) {
        throw new Error("No history available for comparison");
      }

      return {
        type,
        instruction: "このノートの変更履歴を比較します。",
        context: `
## 現在の内容
${ctx.content.summary}

## 過去のバージョン
${ctx.history.recent.map((h, i) => `### ${i + 1}つ前\n${h.summary}`).join("\n\n")}
`.trim(),
        suggestedPrompt: `「${ctx.note.title}」の変更履歴を分析し、どのように内容が進化したか説明してください。`,
        relatedNoteIds: [noteId],
      };
    }

    case "create_outline": {
      if (!noteId) throw new Error("noteId is required");
      const ctx = await getContextForGPT(noteId, { includeOutline: true });

      return {
        type,
        instruction: "このノートのアウトラインを作成/改善してください。",
        context: `
## 現在の構造
${ctx.content.outline?.join("\n") || "見出しなし"}

## 内容
${ctx.content.summary}
`.trim(),
        suggestedPrompt: `「${ctx.note.title}」のアウトラインを改善し、より論理的な構成を提案してください。`,
        relatedNoteIds: [noteId],
      };
    }

    default:
      throw new Error(`Unknown task type: ${type}`);
  }
};

// -------------------------------------
// 全ノートの統計情報（GPT用）
// -------------------------------------
export const getNotesOverviewForGPT = async () => {
  const allNotes = await findAllNotes();

  // カテゴリ別集計
  const categoryCount: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  let totalHistoryCount = 0;

  for (const note of allNotes) {
    // カテゴリ
    const cat = note.category || "その他";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;

    // タグ
    const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }

    // 履歴
    const histories = await findHistoryByNoteId(note.id);
    totalHistoryCount += histories.length;
  }

  // 上位タグ
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalNotes: allNotes.length,
    totalHistoryEntries: totalHistoryCount,
    categoryBreakdown: categoryCount,
    topTags,
    gptSummary: `
Brain Cabinet には ${allNotes.length} 件のノートがあります。
カテゴリ内訳: ${Object.entries(categoryCount).map(([k, v]) => `${k}(${v}件)`).join(", ")}
よく使われるタグ: ${topTags.slice(0, 10).map(t => t.tag).join(", ")}
履歴エントリ総数: ${totalHistoryCount} 件
`.trim(),
  };
};
