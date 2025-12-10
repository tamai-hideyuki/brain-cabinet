/**
 * Brain Cabinet v3 — 統合コマンド型定義
 *
 * 命名規則: {domain}.{operation}
 * - domain: note, cluster, search, drift, ptm, insight, influence, analytics, system
 * - operation: 動詞形（create, search, rebuild, capture など）
 */

import type { Category } from "../db/schema";

// ============================================
// Note ドメイン
// ============================================
type NoteCreateCommand = {
  action: "note.create";
  payload: {
    title: string;
    content: string;
    category?: Category;
    tags?: string[];
  };
};

type NoteGetCommand = {
  action: "note.get";
  payload: {
    id: string;
  };
};

type NoteUpdateCommand = {
  action: "note.update";
  payload: {
    id: string;
    content: string;
    title?: string;
  };
};

type NoteDeleteCommand = {
  action: "note.delete";
  payload: {
    id: string;
  };
};

type NoteListCommand = {
  action: "note.list";
  payload?: {
    limit?: number;
    offset?: number;
  };
};

type NoteHistoryCommand = {
  action: "note.history";
  payload: {
    id: string;
  };
};

type NoteRevertCommand = {
  action: "note.revert";
  payload: {
    noteId: string;
    historyId: string;
  };
};

// ============================================
// Search ドメイン
// ============================================
type SearchQueryCommand = {
  action: "search.query";
  payload: {
    query: string;
    mode?: "keyword" | "semantic" | "hybrid";
    category?: Category;
    tags?: string[];
    limit?: number;
  };
};

type SearchCategoriesCommand = {
  action: "search.categories";
  payload?: Record<string, never>;
};

// ============================================
// Cluster ドメイン
// ============================================
type ClusterListCommand = {
  action: "cluster.list";
  payload?: Record<string, never>;
};

type ClusterGetCommand = {
  action: "cluster.get";
  payload: {
    id: number;
  };
};

type ClusterMapCommand = {
  action: "cluster.map";
  payload?: {
    format?: "full" | "gpt";
  };
};

type ClusterIdentityCommand = {
  action: "cluster.identity";
  payload: {
    id: number;
  };
};

type ClusterRepresentativesCommand = {
  action: "cluster.representatives";
  payload: {
    id: number;
    limit?: number;
  };
};

type ClusterRebuildCommand = {
  action: "cluster.rebuild";
  payload?: {
    k?: number;
    regenerateEmbeddings?: boolean;
  };
};

// ============================================
// Drift ドメイン
// ============================================
type DriftTimelineCommand = {
  action: "drift.timeline";
  payload?: {
    rangeDays?: number;
  };
};

type DriftEventsCommand = {
  action: "drift.events";
  payload?: {
    rangeDays?: number;
    severity?: "low" | "mid" | "high";
  };
};

type DriftSummaryCommand = {
  action: "drift.summary";
  payload?: {
    rangeDays?: number;
  };
};

type DriftAngleCommand = {
  action: "drift.angle";
  payload?: {
    rangeDays?: number;
  };
};

type DriftForecastCommand = {
  action: "drift.forecast";
  payload?: {
    rangeDays?: number;
  };
};

type DriftWarningCommand = {
  action: "drift.warning";
  payload?: {
    rangeDays?: number;
  };
};

type DriftInsightCommand = {
  action: "drift.insight";
  payload?: {
    rangeDays?: number;
  };
};

// ============================================
// PTM (Personal Thinking Model) ドメイン
// ============================================
type PtmTodayCommand = {
  action: "ptm.today";
  payload?: Record<string, never>;
};

type PtmHistoryCommand = {
  action: "ptm.history";
  payload?: {
    limit?: number;
  };
};

type PtmInsightCommand = {
  action: "ptm.insight";
  payload?: {
    date?: string;
  };
};

type PtmCaptureCommand = {
  action: "ptm.capture";
  payload?: {
    date?: string;
  };
};

type PtmCoreCommand = {
  action: "ptm.core";
  payload?: Record<string, never>;
};

type PtmInfluenceCommand = {
  action: "ptm.influence";
  payload?: Record<string, never>;
};

type PtmDynamicsCommand = {
  action: "ptm.dynamics";
  payload?: {
    rangeDays?: number;
  };
};

type PtmStabilityCommand = {
  action: "ptm.stability";
  payload?: {
    date?: string;
  };
};

type PtmSummaryCommand = {
  action: "ptm.summary";
  payload?: Record<string, never>;
};

// ============================================
// Influence ドメイン
// ============================================
type InfluenceStatsCommand = {
  action: "influence.stats";
  payload?: Record<string, never>;
};

type InfluenceInfluencersCommand = {
  action: "influence.influencers";
  payload: {
    noteId: string;
    limit?: number;
  };
};

type InfluenceInfluencedCommand = {
  action: "influence.influenced";
  payload: {
    noteId: string;
    limit?: number;
  };
};

// ============================================
// Cluster Dynamics ドメイン
// ============================================
type ClusterDynamicsSummaryCommand = {
  action: "clusterDynamics.summary";
  payload?: {
    date?: string;
  };
};

type ClusterDynamicsSnapshotCommand = {
  action: "clusterDynamics.snapshot";
  payload?: {
    date?: string;
  };
};

type ClusterDynamicsTimelineCommand = {
  action: "clusterDynamics.timeline";
  payload: {
    clusterId: number;
    rangeDays?: number;
  };
};

type ClusterDynamicsCaptureCommand = {
  action: "clusterDynamics.capture";
  payload?: {
    date?: string;
  };
};

// ============================================
// Insight ドメイン（統合分析）
// ============================================
type InsightLiteCommand = {
  action: "insight.lite";
  payload?: Record<string, never>;
};

type InsightFullCommand = {
  action: "insight.full";
  payload?: Record<string, never>;
};

type InsightCoachCommand = {
  action: "insight.coach";
  payload?: Record<string, never>;
};

// ============================================
// Analytics ドメイン
// ============================================
type AnalyticsSummaryCommand = {
  action: "analytics.summary";
  payload?: Record<string, never>;
};

type AnalyticsTimelineCommand = {
  action: "analytics.timeline";
  payload?: {
    range?: string; // "7d", "30d", "90d", "1y"
  };
};

type AnalyticsJourneyCommand = {
  action: "analytics.journey";
  payload?: {
    range?: string;
  };
};

type AnalyticsHeatmapCommand = {
  action: "analytics.heatmap";
  payload?: {
    year?: number;
  };
};

type AnalyticsTrendsCommand = {
  action: "analytics.trends";
  payload?: {
    unit?: "day" | "week" | "month";
    range?: string;
  };
};

// ============================================
// GPT 専用ドメイン
// ============================================
type GptSearchCommand = {
  action: "gpt.search";
  payload: {
    query: string;
    mode?: "keyword" | "semantic" | "hybrid";
    category?: Category;
    tags?: string[];
    limit?: number;
  };
};

type GptContextCommand = {
  action: "gpt.context";
  payload?: {
    noteId?: string;
    query?: string;
  };
};

type GptTaskCommand = {
  action: "gpt.task";
  payload?: Record<string, never>;
};

type GptOverviewCommand = {
  action: "gpt.overview";
  payload?: Record<string, never>;
};

// ============================================
// Embedding ドメイン
// ============================================
type EmbeddingRecalcAllCommand = {
  action: "embedding.recalcAll";
  payload?: {
    force?: boolean;
  };
};

// ============================================
// Workflow ドメイン
// ============================================
type WorkflowReconstructCommand = {
  action: "workflow.reconstruct";
  payload?: Record<string, never>;
};

type WorkflowStatusCommand = {
  action: "workflow.status";
  payload?: Record<string, never>;
};

// ============================================
// System/Debug ドメイン
// ============================================
type SystemHealthCommand = {
  action: "system.health";
  payload?: Record<string, never>;
};

type SystemEmbedCommand = {
  action: "system.embed";
  payload: {
    text: string;
  };
};

type DebugHealthcheckCommand = {
  action: "debug.healthcheck";
  payload?: Record<string, never>;
};

type SystemRebuildFtsCommand = {
  action: "system.rebuildFts";
  payload?: Record<string, never>;
};

// ============================================
// 統合型
// ============================================
export type BrainCommand =
  // Note
  | NoteCreateCommand
  | NoteGetCommand
  | NoteUpdateCommand
  | NoteDeleteCommand
  | NoteListCommand
  | NoteHistoryCommand
  | NoteRevertCommand
  // Search
  | SearchQueryCommand
  | SearchCategoriesCommand
  // Cluster
  | ClusterListCommand
  | ClusterGetCommand
  | ClusterMapCommand
  | ClusterIdentityCommand
  | ClusterRepresentativesCommand
  | ClusterRebuildCommand
  // Drift
  | DriftTimelineCommand
  | DriftEventsCommand
  | DriftSummaryCommand
  | DriftAngleCommand
  | DriftForecastCommand
  | DriftWarningCommand
  | DriftInsightCommand
  // PTM
  | PtmTodayCommand
  | PtmHistoryCommand
  | PtmInsightCommand
  | PtmCaptureCommand
  | PtmCoreCommand
  | PtmInfluenceCommand
  | PtmDynamicsCommand
  | PtmStabilityCommand
  | PtmSummaryCommand
  // Influence
  | InfluenceStatsCommand
  | InfluenceInfluencersCommand
  | InfluenceInfluencedCommand
  // Cluster Dynamics
  | ClusterDynamicsSummaryCommand
  | ClusterDynamicsSnapshotCommand
  | ClusterDynamicsTimelineCommand
  | ClusterDynamicsCaptureCommand
  // Insight
  | InsightLiteCommand
  | InsightFullCommand
  | InsightCoachCommand
  // Analytics
  | AnalyticsSummaryCommand
  | AnalyticsTimelineCommand
  | AnalyticsJourneyCommand
  | AnalyticsHeatmapCommand
  | AnalyticsTrendsCommand
  // GPT
  | GptSearchCommand
  | GptContextCommand
  | GptTaskCommand
  | GptOverviewCommand
  // Embedding
  | EmbeddingRecalcAllCommand
  // Workflow
  | WorkflowReconstructCommand
  | WorkflowStatusCommand
  // System/Debug
  | SystemHealthCommand
  | SystemEmbedCommand
  | SystemRebuildFtsCommand
  | DebugHealthcheckCommand;

// ============================================
// レスポンス型
// ============================================
export type CommandSuccessResponse<T = unknown> = {
  success: true;
  action: string;
  result: T;
  timestamp: number;
};

export type CommandErrorResponse = {
  success: false;
  action: string;
  error: {
    code: string;
    message: string;
  };
  timestamp: number;
};

export type CommandResponse<T = unknown> =
  | CommandSuccessResponse<T>
  | CommandErrorResponse;

// ============================================
// ヘルパー型（payload 抽出用）
// ============================================
export type ExtractPayload<A extends BrainCommand["action"]> = Extract<
  BrainCommand,
  { action: A }
> extends { payload: infer P }
  ? P
  : never;

// アクション名のユニオン型
export type ActionName = BrainCommand["action"];
