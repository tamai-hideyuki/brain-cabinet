/**
 * v5.13 GPT向けコンテキスト最適化サービス
 *
 * GPTが効率的に分析データを活用できるよう、統合コンテキストを提供
 * - 複数APIの結果を集約
 * - 優先度付きでフィルタリング
 * - トークン数を意識した簡潔な出力
 */

import { getSummaryStats } from "../../analytics";
import { analyzeGlobalTimescales } from "../../analytics/multiTimescale";
import { getGlobalCausalSummary } from "../../influence/causalInference";
import { analyzeDriftFlows } from "../../drift/driftDirection";
import { getInfluenceStats } from "../../influence/influenceService";
import { getGlobalQualityMetrics } from "../../cluster/metrics";
import { findAllClusters } from "../../../repositories/clusterRepo";
import { getOrCompute, generateCacheKey } from "../../cache";

// ============================================
// 型定義
// ============================================

export type ImportanceLevel = "high" | "medium" | "low";

export type Priority = {
  type: "insight" | "warning" | "opportunity";
  message: string;
  importance: ImportanceLevel;
  cluster?: number;
};

export type RecentActivity = {
  notesUpdated: number;
  notesCreated: number;
  dominantCluster: number | null;
  driftTrend: "expansion" | "contraction" | "stable" | "pivot";
  avgSemanticDiff: number;
};

export type Recommendation = {
  message: string;
  actionType: "explore" | "review" | "connect" | "organize";
};

export type GptContext = {
  generatedAt: string;
  summary: string;
  priorities: Priority[];
  recentActivity: RecentActivity;
  recommendations: Recommendation[];
  detailEndpoints: Record<string, string>;
};

export type GptContextOptions = {
  focus?: "overview" | "trends" | "warnings" | "recommendations";
  maxPriorities?: number;
  maxRecommendations?: number;
};

// ============================================
// メイン関数
// ============================================

/**
 * GPT向け統合コンテキストを生成
 */
export async function generateGptContext(
  options: GptContextOptions = {}
): Promise<GptContext> {
  const {
    focus = "overview",
    maxPriorities = 5,
    maxRecommendations = 3,
  } = options;

  // 並列でデータ取得（キャッシュ活用）
  const [
    summaryStats,
    timescaleAnalysis,
    causalSummary,
    driftFlows,
    influenceStats,
    qualityMetrics,
    clusters,
  ] = await Promise.all([
    getSummaryStats(),
    safeCall(() => analyzeGlobalTimescales()),
    safeCall(() => getGlobalCausalSummary()),
    safeCall(() => analyzeDriftFlows(30)),
    safeCall(() => getInfluenceStats()),
    safeCall(() => getGlobalQualityMetrics()),
    findAllClusters(),
  ]);

  // 優先事項を抽出
  const priorities = extractPriorities(
    summaryStats,
    timescaleAnalysis,
    causalSummary,
    driftFlows,
    qualityMetrics,
    focus
  ).slice(0, maxPriorities);

  // 最近の活動を集計
  const recentActivity = buildRecentActivity(
    summaryStats,
    timescaleAnalysis,
    driftFlows
  );

  // レコメンデーションを生成
  const recommendations = generateRecommendations(
    summaryStats,
    timescaleAnalysis,
    causalSummary,
    qualityMetrics,
    priorities
  ).slice(0, maxRecommendations);

  // サマリー文を生成
  const summary = generateSummary(
    summaryStats,
    recentActivity,
    priorities,
    clusters.length
  );

  return {
    generatedAt: new Date().toISOString(),
    summary,
    priorities,
    recentActivity,
    recommendations,
    detailEndpoints: {
      timescale: "/api/analytics/timescale",
      causal: "/api/influence/causal/summary",
      driftFlows: "/api/drift/flows",
      clusterQuality: "/api/clusters/quality",
      influence: "/api/influence/summary",
    },
  };
}

/**
 * キャッシュ付きでGPTコンテキストを取得
 */
export async function getGptContext(
  options: GptContextOptions = {}
): Promise<GptContext> {
  const cacheKey = generateCacheKey("gpt_context", options);
  return getOrCompute(
    cacheKey,
    "gpt_context",
    () => generateGptContext(options)
  );
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * 安全に非同期関数を呼び出し、エラー時はnullを返す
 */
async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * 優先事項を抽出
 */
function extractPriorities(
  summaryStats: Awaited<ReturnType<typeof getSummaryStats>>,
  timescale: Awaited<ReturnType<typeof analyzeGlobalTimescales>> | null,
  causal: Awaited<ReturnType<typeof getGlobalCausalSummary>> | null,
  driftFlows: Awaited<ReturnType<typeof analyzeDriftFlows>> | null,
  quality: Awaited<ReturnType<typeof getGlobalQualityMetrics>> | null,
  focus: string
): Priority[] {
  const priorities: Priority[] = [];

  // タイムスケール分析からの洞察
  if (timescale) {
    const weeklyTrend = timescale.globalTrends.weekly;
    if (weeklyTrend.velocity > 0.5 && weeklyTrend.confidence > 0.6) {
      priorities.push({
        type: "insight",
        message: `今週は${weeklyTrend.direction === "rising" ? "成長" : "収束"}傾向が顕著です`,
        importance: "high",
      });
    }

    // トップ成長クラスター
    if (timescale.topGrowingClusters.length > 0) {
      const top = timescale.topGrowingClusters[0];
      priorities.push({
        type: "insight",
        message: `クラスター${top.clusterId}が最も活発に成長しています`,
        importance: "medium",
        cluster: top.clusterId,
      });
    }

    // 衰退クラスター警告
    if (timescale.topDecliningClusters.length > 0) {
      const declining = timescale.topDecliningClusters[0];
      priorities.push({
        type: "warning",
        message: `クラスター${declining.clusterId}の活動が低下しています`,
        importance: "medium",
        cluster: declining.clusterId,
      });
    }
  }

  // 因果分析からの洞察
  if (causal) {
    if (causal.pivotNotes.length > 0) {
      const topPivot = causal.pivotNotes[0];
      priorities.push({
        type: "insight",
        message: `「${topPivot.title}」が思考の転換点として重要な役割を果たしています`,
        importance: "high",
      });
    }

    if (causal.strongCausalRelations > 10) {
      priorities.push({
        type: "insight",
        message: `${causal.strongCausalRelations}件の強い因果関係があり、知識が体系化されています`,
        importance: "medium",
      });
    }
  }

  // ドリフト分析からの洞察
  if (driftFlows) {
    if (driftFlows.dominantFlow) {
      priorities.push({
        type: "insight",
        message: `クラスター${driftFlows.dominantFlow.fromClusterId}→${driftFlows.dominantFlow.toClusterId}への思考の流れが活発です`,
        importance: "medium",
        cluster: driftFlows.dominantFlow.toClusterId,
      });
    }
  }

  // 品質警告
  if (quality) {
    if (quality.overallSilhouette < 0.3) {
      priorities.push({
        type: "warning",
        message: "クラスタリング品質が低下しています。再構築を検討してください",
        importance: "high",
      });
    }

    // サブクラスター検出
    const withSubClusters = quality.clusterMetrics.filter(
      (cm) => cm.subClusterAnalysis.hasSubClusters
    );
    if (withSubClusters.length > 0) {
      priorities.push({
        type: "opportunity",
        message: `${withSubClusters.length}個のクラスターに細分化の可能性があります`,
        importance: "low",
      });
    }
  }

  // 活動低下警告
  if (summaryStats.notesLast30Days < 3) {
    priorities.push({
      type: "warning",
      message: "過去30日間の新規ノートが少なめです",
      importance: "low",
    });
  }

  // 重要度でソート
  const importanceOrder: Record<ImportanceLevel, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  priorities.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

  // フォーカスに応じてフィルタリング
  if (focus === "warnings") {
    return priorities.filter((p) => p.type === "warning");
  }
  if (focus === "trends") {
    return priorities.filter((p) => p.type === "insight");
  }

  return priorities;
}

/**
 * 最近の活動を集計
 */
function buildRecentActivity(
  summaryStats: Awaited<ReturnType<typeof getSummaryStats>>,
  timescale: Awaited<ReturnType<typeof analyzeGlobalTimescales>> | null,
  driftFlows: Awaited<ReturnType<typeof analyzeDriftFlows>> | null
): RecentActivity {
  // ドリフトトレンドを判定
  let driftTrend: RecentActivity["driftTrend"] = "stable";
  if (timescale) {
    const weekly = timescale.globalTrends.weekly;
    if (weekly.direction === "rising" && weekly.velocity > 0.3) {
      driftTrend = "expansion";
    } else if (weekly.direction === "falling" && weekly.velocity > 0.3) {
      driftTrend = "contraction";
    }
    // Note: "pivot" はクラスター変更時に使用されるため、ここではstableのまま
  }

  // 支配的クラスターを特定
  let dominantCluster: number | null = null;
  if (driftFlows?.clusterSummaries && driftFlows.clusterSummaries.length > 0) {
    // 最も活発なクラスターを取得
    const sorted = [...driftFlows.clusterSummaries].sort(
      (a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow)
    );
    if (sorted.length > 0) {
      dominantCluster = sorted[0].clusterId;
    }
  }

  return {
    notesUpdated: summaryStats.changesLast30Days,
    notesCreated: summaryStats.notesLast30Days,
    dominantCluster,
    driftTrend,
    avgSemanticDiff: summaryStats.avgSemanticDiffLast30Days,
  };
}

/**
 * レコメンデーションを生成
 */
function generateRecommendations(
  summaryStats: Awaited<ReturnType<typeof getSummaryStats>>,
  timescale: Awaited<ReturnType<typeof analyzeGlobalTimescales>> | null,
  causal: Awaited<ReturnType<typeof getGlobalCausalSummary>> | null,
  quality: Awaited<ReturnType<typeof getGlobalQualityMetrics>> | null,
  priorities: Priority[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 成長クラスターの深掘りを推奨
  if (timescale?.topGrowingClusters.length) {
    const top = timescale.topGrowingClusters[0];
    recommendations.push({
      message: `クラスター${top.clusterId}の内容を深掘りすると良いかもしれません`,
      actionType: "explore",
    });
  }

  // 衰退クラスターのレビューを推奨
  if (timescale?.topDecliningClusters.length) {
    const declining = timescale.topDecliningClusters[0];
    recommendations.push({
      message: `クラスター${declining.clusterId}のノートを見直してみましょう`,
      actionType: "review",
    });
  }

  // 因果関係が弱い場合の接続推奨
  if (causal && causal.totalCausalPairs < 5 && summaryStats.totalNotes > 10) {
    recommendations.push({
      message: "ノート間の関連付けを意識すると、知識がより体系化されます",
      actionType: "connect",
    });
  }

  // 品質改善の推奨
  if (quality && quality.overallSilhouette < 0.4) {
    recommendations.push({
      message: "クラスタリングの再構築で、ノートの整理が改善される可能性があります",
      actionType: "organize",
    });
  }

  // 活動が少ない場合
  if (summaryStats.changesLast30Days < 5) {
    recommendations.push({
      message: "既存のノートを更新・拡充してみましょう",
      actionType: "review",
    });
  }

  // 高優先度の警告がある場合
  const highWarnings = priorities.filter(
    (p) => p.type === "warning" && p.importance === "high"
  );
  if (highWarnings.length > 0) {
    recommendations.unshift({
      message: "重要な警告があります。先に対処することをお勧めします",
      actionType: "review",
    });
  }

  return recommendations;
}

/**
 * サマリー文を生成
 */
function generateSummary(
  summaryStats: Awaited<ReturnType<typeof getSummaryStats>>,
  recentActivity: RecentActivity,
  priorities: Priority[],
  clusterCount: number
): string {
  const parts: string[] = [];

  // 基本統計
  parts.push(`${summaryStats.totalNotes}個のノートが${clusterCount}個のクラスターに整理されています。`);

  // 最近の活動
  if (recentActivity.notesCreated > 0 || recentActivity.notesUpdated > 0) {
    const activityParts: string[] = [];
    if (recentActivity.notesCreated > 0) {
      activityParts.push(`${recentActivity.notesCreated}個の新規ノート`);
    }
    if (recentActivity.notesUpdated > 0) {
      activityParts.push(`${recentActivity.notesUpdated}回の更新`);
    }
    parts.push(`過去30日間: ${activityParts.join("、")}。`);
  }

  // トレンド
  const trendDescriptions: Record<RecentActivity["driftTrend"], string> = {
    expansion: "思考が拡張傾向にあります",
    contraction: "思考が収束傾向にあります",
    pivot: "思考の方向が転換しています",
    stable: "安定した思考パターンです",
  };
  parts.push(trendDescriptions[recentActivity.driftTrend] + "。");

  // 最重要な洞察
  const highPriority = priorities.find((p) => p.importance === "high");
  if (highPriority) {
    parts.push(highPriority.message + "。");
  }

  return parts.join(" ");
}
