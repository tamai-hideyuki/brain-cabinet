/**
 * GPT連携サービス
 * - GPTが使いやすい形式でデータを提供
 * - 複合検索
 * - コンテキスト抽出
 */

import { searchNotesInDB } from "../../repositories/searchRepo";
import { findNoteById, findAllNotes } from "../../repositories/notesRepo";
import { findHistoryByNoteId } from "../../repositories/historyRepo";
import { normalizeMarkdown, formatForGPT, extractOutline, extractBulletPoints } from "../../utils/markdown";
import { normalizeForGPT } from "../../utils/normalize";
import { generateMetaStateLite } from "../ptm/engine";
import type { PtmMetaStateLite } from "../ptm/types";
import { getLatestInference, classify, getSearchPriority } from "../inference";
import { searchDecisions, getDecisionContext } from "../decision";

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

// -------------------------------------
// GPT タスク推奨（PTM分析ベース）
// -------------------------------------

export type TaskPriority = "high" | "medium" | "low";
export type TaskCategory =
  | "explore"      // 新しい領域を探索
  | "deepen"       // 既存領域を深掘り
  | "connect"      // ノート間をつなげる
  | "review"       // 振り返り・整理
  | "balance";     // バランス調整

export interface RecommendedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  reason: string;
  relatedCluster?: number;
  relatedKeywords?: string[];
}

export interface TaskRecommendationResponse {
  date: string;
  thinkingState: {
    mode: string;
    season: string;
    state: string;
    trend: string;
    growthAngle: number;
  };
  coach: {
    today: string;
    tomorrow: string;
    balance: string;
    warning: string | null;
  };
  tasks: RecommendedTask[];
  summary: string;
}

/**
 * 思考パターン分析に基づくタスク推奨を生成
 */
export const generateTaskRecommendations = async (): Promise<TaskRecommendationResponse> => {
  // PTM MetaState を取得
  let metaState: PtmMetaStateLite;
  try {
    metaState = await generateMetaStateLite();
  } catch {
    // PTMデータがない場合はフォールバック
    return generateFallbackTaskRecommendations();
  }

  const { mode, season, state, trend, growthAngle, topClusters, coach } = metaState;

  const tasks: RecommendedTask[] = [];

  // 1. 状態に基づくタスク生成
  if (state === "overheat") {
    tasks.push({
      id: "review-organize",
      title: "既存ノートの整理",
      description: "最近書いたノートを振り返り、重複や矛盾がないか確認しましょう。",
      category: "review",
      priority: "high",
      reason: "思考が過熱状態です。一度立ち止まって整理することで、より深い理解につながります。",
    });
  } else if (state === "stagnation") {
    tasks.push({
      id: "explore-new",
      title: "新しいテーマの探索",
      description: "普段触れない分野の記事や本を読んで、新しいインスピレーションを得ましょう。",
      category: "explore",
      priority: "high",
      reason: "思考が停滞しています。新しい刺激が成長のきっかけになります。",
    });
  }

  // 2. モードに基づくタスク生成
  if (mode === "exploration" && season === "broad_search") {
    tasks.push({
      id: "focus-one-topic",
      title: "一つのテーマに集中",
      description: "最近触れた複数のテーマから、最も気になる一つを選んで深掘りしましょう。",
      category: "deepen",
      priority: "medium",
      reason: "探索が広がっています。一つに絞ることで理解が深まります。",
    });
  } else if (mode === "consolidation" && season === "deep_focus") {
    const focusCluster = topClusters.length > 0 ? topClusters[0] : null;
    if (focusCluster) {
      tasks.push({
        id: "connect-cluster-notes",
        title: `${focusCluster.keywords.slice(0, 2).join("・")}のノートをつなげる`,
        description: "集中している領域のノート同士の関連を見つけ、リンクを追加しましょう。",
        category: "connect",
        priority: "medium",
        reason: "統合フェーズです。関連するノートをつなげることで知識が構造化されます。",
        relatedCluster: focusCluster.clusterId,
        relatedKeywords: focusCluster.keywords,
      });
    }
  }

  // 3. トレンドに基づくタスク生成
  if (trend === "rising" && growthAngle > 15) {
    tasks.push({
      id: "maintain-pace",
      title: "このペースを維持",
      description: "良い成長リズムです。今日も1つノートを書いてみましょう。",
      category: "deepen",
      priority: "low",
      reason: `成長角度 ${growthAngle.toFixed(1)}° で上昇中。このペースを続けましょう。`,
    });
  } else if (trend === "falling") {
    tasks.push({
      id: "small-note",
      title: "小さなノートから始める",
      description: "完璧を目指さず、短いメモでも良いので思ったことを書いてみましょう。",
      category: "explore",
      priority: "medium",
      reason: "成長ペースが落ち着いています。小さな一歩から再開しましょう。",
    });
  }

  // 4. クラスタの役割に基づくタスク生成
  const drivers = topClusters.filter(c => c.role === "driver");
  const stabilizers = topClusters.filter(c => c.role === "stabilizer");
  const isolated = topClusters.filter(c => c.role === "isolated");

  if (drivers.length > 0 && stabilizers.length === 0) {
    tasks.push({
      id: "build-foundation",
      title: "基盤となるノートを強化",
      description: "成長に偏りがあります。基礎的な知識をまとめたノートを作成しましょう。",
      category: "balance",
      priority: "medium",
      reason: "成長領域(Driver)はありますが、安定した基盤(Stabilizer)が不足しています。",
    });
  }

  if (isolated.length > 0) {
    const isolatedCluster = isolated[0];
    tasks.push({
      id: "connect-isolated",
      title: `孤立したクラスタをつなげる`,
      description: `${isolatedCluster.keywords.slice(0, 2).join("・")}の領域が他とつながっていません。関連を見つけてリンクしましょう。`,
      category: "connect",
      priority: "low",
      reason: "孤立した思考領域があります。他の領域とつなげることで新しい発見があるかもしれません。",
      relatedCluster: isolatedCluster.clusterId,
      relatedKeywords: isolatedCluster.keywords,
    });
  }

  // 5. 常に表示する定期タスク
  if (tasks.length < 3) {
    tasks.push({
      id: "daily-reflection",
      title: "今日の振り返り",
      description: "今日学んだこと、考えたことを1つノートにまとめましょう。",
      category: "review",
      priority: "low",
      reason: "定期的な振り返りは思考の整理に効果的です。",
    });
  }

  // 優先度順にソート
  const priorityOrder: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
  tasks.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

  // サマリー生成
  const summary = generateTaskSummary(metaState, tasks);

  return {
    date: metaState.date,
    thinkingState: {
      mode,
      season,
      state,
      trend,
      growthAngle,
    },
    coach,
    tasks: tasks.slice(0, 5), // 最大5件
    summary,
  };
};

/**
 * タスク推奨のサマリーを生成
 */
function generateTaskSummary(metaState: PtmMetaStateLite, tasks: RecommendedTask[]): string {
  const { mode, state, trend, topClusters } = metaState;

  const modeDesc: Record<string, string> = {
    exploration: "探索モード",
    consolidation: "統合モード",
    refactoring: "再構成モード",
    rest: "休息モード",
  };

  const stateDesc: Record<string, string> = {
    stable: "安定",
    overheat: "過熱",
    stagnation: "停滞",
  };

  const trendDesc: Record<string, string> = {
    rising: "上昇中",
    falling: "下降中",
    flat: "横ばい",
  };

  const topKeywords = topClusters.length > 0
    ? topClusters[0].keywords.slice(0, 3).join("、")
    : "なし";

  const highPriorityCount = tasks.filter(t => t.priority === "high").length;

  let summary = `現在は${modeDesc[mode] || mode}で、成長ペースは${trendDesc[trend] || trend}（${stateDesc[state] || state}状態）です。`;

  if (topKeywords !== "なし") {
    summary += `\n最も活発な領域: ${topKeywords}`;
  }

  if (highPriorityCount > 0) {
    summary += `\n優先度の高いタスクが${highPriorityCount}件あります。`;
  }

  return summary;
}

/**
 * PTMデータがない場合のフォールバック
 */
async function generateFallbackTaskRecommendations(): Promise<TaskRecommendationResponse> {
  const overview = await getNotesOverviewForGPT();

  const tasks: RecommendedTask[] = [
    {
      id: "start-writing",
      title: "新しいノートを書く",
      description: "今日学んだこと、考えたことをノートにまとめましょう。",
      category: "explore",
      priority: "medium",
      reason: "定期的なノート作成は思考の整理に効果的です。",
    },
    {
      id: "review-recent",
      title: "最近のノートを振り返る",
      description: "過去1週間に書いたノートを読み返してみましょう。",
      category: "review",
      priority: "low",
      reason: "振り返りは記憶の定着と新しい発見につながります。",
    },
  ];

  return {
    date: new Date().toISOString().split("T")[0],
    thinkingState: {
      mode: "unknown",
      season: "unknown",
      state: "stable",
      trend: "flat",
      growthAngle: 0,
    },
    coach: {
      today: "今日もノートを書いて思考を整理しましょう。",
      tomorrow: "明日は新しいテーマに挑戦してみましょう。",
      balance: "バランス良く様々なテーマに触れましょう。",
      warning: null,
    },
    tasks,
    summary: `Brain Cabinetには${overview.totalNotes}件のノートがあります。思考パターン分析のためにはクラスタ再構築が必要です。`,
  };
}

// -------------------------------------
// GPT 判断コーチング
// -------------------------------------

export interface CoachDecisionResponse {
  query: string;
  pastDecisions: Array<{
    noteId: string;
    title: string;
    confidence: number;
    confidenceDetail?: {
      structural: number;
      experiential: number;
      temporal: number;
    };
    decayProfile: string;
    effectiveScore: number;
    reasoning: string;
    excerpt: string;
  }>;
  relatedLearnings: Array<{
    noteId: string;
    title: string;
    excerpt: string;
  }>;
  coachingAdvice: string;
}

/**
 * 判断コーチング - 過去の判断を参照して意思決定を支援
 */
export const coachDecision = async (query: string): Promise<CoachDecisionResponse> => {
  // 1. 関連する過去の判断を検索
  const decisions = await searchDecisions(query, {
    minConfidence: 0.4,
    limit: 5,
  });

  // 2. 関連する学習ノートを収集
  const learningNotes: CoachDecisionResponse["relatedLearnings"] = [];
  const seenLearningIds = new Set<string>();

  for (const decision of decisions.slice(0, 3)) {
    const context = await getDecisionContext(decision.noteId);
    if (context) {
      for (const learning of context.relatedLearnings) {
        if (!seenLearningIds.has(learning.noteId)) {
          seenLearningIds.add(learning.noteId);
          learningNotes.push(learning);
        }
      }
    }
  }

  // 3. コーチングアドバイスを生成
  let coachingAdvice: string;

  if (decisions.length === 0) {
    coachingAdvice = `「${query}」に関連する過去の判断は見つかりませんでした。新しい判断を下す際は、理由と背景を明確にしてノートに残すことをお勧めします。`;
  } else {
    const topDecision = decisions[0];
    const decisionCount = decisions.length;

    coachingAdvice = `「${query}」に関連して、過去に${decisionCount}件の判断を行っています。

【最も関連する過去の判断】
${topDecision.title}
- 信頼度: ${(topDecision.confidence * 100).toFixed(0)}%
- 理由: ${topDecision.reasoning}

${decisions.length > 1 ? `他にも${decisions.length - 1}件の関連判断があります。` : ""}
${learningNotes.length > 0 ? `\n関連する学習ノートが${learningNotes.length}件あり、判断の根拠として参照できます。` : ""}

今回も同様の状況であれば、過去の判断を参考にできます。状況が異なる場合は、その違いを明確にした上で新しい判断を下しましょう。`;
  }

  return {
    query,
    pastDecisions: decisions.map((d) => ({
      noteId: d.noteId,
      title: d.title,
      confidence: d.confidence,
      confidenceDetail: d.confidenceDetail,
      decayProfile: d.decayProfile,
      effectiveScore: d.effectiveScore,
      reasoning: d.reasoning,
      excerpt: d.excerpt,
    })),
    relatedLearnings: learningNotes.slice(0, 5),
    coachingAdvice,
  };
};

// -------------------------------------
// GPT検索（判断優先版）
// -------------------------------------

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

/**
 * GPT向け検索（判断ノートを優先）
 */
export const searchForGPTWithInference = async (
  options: GPTSearchOptions
): Promise<{
  results: GPTSearchWithInferenceResult[];
  totalFound: number;
  searchContext: string;
}> => {
  // 基本検索を実行
  const baseResult = await searchForGPT(options);

  // 各結果に推論情報を付与
  const resultsWithInference: GPTSearchWithInferenceResult[] = [];

  for (const result of baseResult.results) {
    const inference = await getLatestInference(result.id);

    let searchPriority = 50; // デフォルト

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

  // searchPriority でソート（判断ノートが上位に）
  resultsWithInference.sort((a, b) => {
    // まず searchPriority、次に relevance
    if (b.searchPriority !== a.searchPriority) {
      return b.searchPriority - a.searchPriority;
    }
    const order = { high: 3, medium: 2, low: 1 };
    return order[b.relevance] - order[a.relevance];
  });

  // 検索コンテキストを更新
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
