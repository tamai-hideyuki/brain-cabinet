/**
 * PTM (Personal Thinking Model) 型定義
 *
 * Option C: Drift × Influence × Cluster Dynamics 統合モデル
 */

// ============================================================
// Core Metrics
// ============================================================

export type ClusterWeight = {
  clusterId: number;
  noteCount: number;
  weight: number; // 0.0〜1.0（構成比）
};

export type ClusterCentroid = {
  clusterId: number;
  centroid: number[];
  noteCount: number;
};

export type CoreMetrics = {
  totalNotes: number;
  clusterCount: number;
  globalCentroid: number[] | null;
  clusterWeights: ClusterWeight[];
  dominantCluster: number | null;
};

// ============================================================
// Drift Metrics
// ============================================================

export type DriftMetrics = {
  driftToday: number;
  driftEma: number;
  growthAngle: number;
  trend: "rising" | "falling" | "flat";
  state: "stable" | "overheat" | "stagnation";
};

// ============================================================
// Influence Metrics
// ============================================================

export type InfluencerSummary = {
  noteId: string;
  outWeight: number;
  edgeCount: number;
};

export type InfluencedSummary = {
  noteId: string;
  inWeight: number;
  edgeCount: number;
};

export type ClusterInfluence = {
  clusterId: number;
  given: number;   // 他に与えた影響
  received: number; // 他から受けた影響
};

export type InfluenceMetrics = {
  totalEdges: number;
  avgWeight: number;
  topInfluencers: InfluencerSummary[];
  topInfluenced: InfluencedSummary[];
  clusterInfluence: ClusterInfluence[];
  primaryHubNote: string | null;
};

// ============================================================
// Drift × Influence Dynamics
// ============================================================

export type ClusterDriftContribution = {
  clusterId: number;
  driftSum: number;
  ratio: number; // 0.0〜1.0
};

export type DriftPropagation = {
  sourceCluster: number;
  targetCluster: number;
  effectiveInfluence: number;
};

export type ThinkingMode =
  | "exploration"     // 探索フェーズ（drift大、多クラスタ伝播）
  | "consolidation"   // 統合フェーズ（drift中〜小、同一クラスタ内中心）
  | "refactoring"     // 再構成フェーズ（重心移動大）
  | "rest";           // 休息フェーズ（drift小）

export type ThinkingSeason =
  | "deep_focus"      // 一つのクラスタに集中
  | "broad_search"    // 複数クラスタを渡り歩く
  | "structuring"     // 構造化期
  | "balanced";       // バランス型

export type DynamicsMetrics = {
  clusterDriftContributions: ClusterDriftContribution[];
  topDriftCluster: number | null;
  driftPropagation: DriftPropagation[];
  mode: ThinkingMode;
  season: ThinkingSeason;
};

// ============================================================
// Cluster Stability
// ============================================================

export type ClusterStability = {
  clusterId: number;
  cohesion: number;
  stabilityScore: number | null;
  noteCount: number;
};

export type StabilityMetrics = {
  avgCohesion: number;
  avgStability: number | null;
  mostStableCluster: number | null;
  mostUnstableCluster: number | null;
  clusters: ClusterStability[];
};

// ============================================================
// PTM Snapshot (最終出力)
// ============================================================

export type PtmSnapshot = {
  date: string;

  // Core
  totalNotes: number;
  clusterCount: number;
  dominantCluster: number | null;
  clusterWeights: ClusterWeight[];

  // Drift
  driftToday: number;
  driftEma: number;
  growthAngle: number;
  trend: "rising" | "falling" | "flat";
  state: "stable" | "overheat" | "stagnation";

  // Influence
  totalInfluenceEdges: number;
  primaryHubNote: string | null;
  topInfluencers: InfluencerSummary[];
  topClustersByDrift: ClusterDriftContribution[];

  // Dynamics
  mode: ThinkingMode;
  season: ThinkingSeason;

  // Stability
  avgCohesion: number;
  avgStability: number | null;

  // Meta
  capturedAt: string;
  insight?: string;
};

// ============================================================
// API Response Types
// ============================================================

export type PtmTodayResponse = PtmSnapshot;

export type PtmHistoryResponse = {
  range: string;
  snapshots: PtmSnapshot[];
};

export type PtmInsightResponse = {
  date: string;
  snapshot: PtmSnapshot;
  interpretation: {
    growthSummary: string;
    influenceSummary: string;
    stabilitySummary: string;
    recommendation: string;
  };
};
