/**
 * GPT タスク準備・推奨
 */

import { findNoteById, findAllNotes } from "../../repositories/notesRepo";
import { findHistoryByNoteId } from "../../repositories/historyRepo";
import { generateMetaStateLite } from "../ptm/engine";
import type { PtmMetaStateLite } from "../ptm/types";
import { searchForGPT } from "./search";
import { getContextForGPT } from "./context";

// -------------------------------------
// タスク準備（型定義）
// -------------------------------------
export type GPTTaskType =
  | "extract_key_points"
  | "summarize"
  | "generate_ideas"
  | "find_related"
  | "compare_versions"
  | "create_outline";

export interface GPTTaskRequest {
  type: GPTTaskType;
  noteId?: string;
  query?: string;
  options?: Record<string, any>;
}

export interface GPTTaskResponse {
  type: GPTTaskType;
  instruction: string;
  context: string;
  suggestedPrompt: string;
  relatedNoteIds?: string[];
}

// -------------------------------------
// タスク推奨（型定義）
// -------------------------------------
export type TaskPriority = "high" | "medium" | "low";
export type TaskCategory =
  | "explore"
  | "deepen"
  | "connect"
  | "review"
  | "balance";

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

// -------------------------------------
// タスク準備
// -------------------------------------
export const prepareGPTTask = async (request: GPTTaskRequest): Promise<GPTTaskResponse> => {
  const { type, noteId, query } = request;

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

  const categoryCount: Record<string, number> = {};
  const tagCount: Record<string, number> = {};
  let totalHistoryCount = 0;

  for (const note of allNotes) {
    const cat = note.category || "その他";
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;

    const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    }

    const histories = await findHistoryByNoteId(note.id);
    totalHistoryCount += histories.length;
  }

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
// タスク推奨（PTM分析ベース）
// -------------------------------------
export const generateTaskRecommendations = async (): Promise<TaskRecommendationResponse> => {
  let metaState: PtmMetaStateLite;
  try {
    metaState = await generateMetaStateLite();
  } catch {
    return generateFallbackTaskRecommendations();
  }

  const { mode, season, state, trend, growthAngle, topClusters, coach } = metaState;
  const tasks: RecommendedTask[] = [];

  // 状態に基づくタスク生成
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

  // モードに基づくタスク生成
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

  // トレンドに基づくタスク生成
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

  // クラスタの役割に基づくタスク生成
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

  // 常に表示する定期タスク
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
    tasks: tasks.slice(0, 5),
    summary,
  };
};

// -------------------------------------
// ヘルパー関数
// -------------------------------------
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
