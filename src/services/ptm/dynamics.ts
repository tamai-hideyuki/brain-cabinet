/**
 * PTM Dynamics Engine
 *
 * Drift × Influence の因果関係を分析
 * - クラスタ別 Drift 寄与
 * - 伝播マトリクス
 * - Mode / Season 判定
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { getDailyDriftData, calcGrowthAngle, detectWarning } from "../drift/driftCore";
import { computeClusterInfluenceFlow } from "./influence";
import type {
  DynamicsMetrics,
  ClusterDriftContribution,
  DriftPropagation,
  ThinkingMode,
  ThinkingSeason,
  DriftMetrics,
  StabilityMetrics,
  ClusterStability,
} from "./types";

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Drift Metrics を取得（既存の driftCore を活用）
 */
export async function computeDriftMetrics(rangeDays: number = 30): Promise<DriftMetrics> {
  const data = await getDailyDriftData(rangeDays);
  const angle = calcGrowthAngle(data);
  const warning = detectWarning(data);

  const today = data.length > 0 ? data[data.length - 1] : null;

  return {
    driftToday: today?.drift ?? 0,
    driftEma: today?.ema ?? 0,
    growthAngle: angle.angleDegrees,
    trend: angle.trend,
    state: warning.state,
  };
}

/**
 * クラスタ別 Drift 寄与を計算
 * どのクラスタが今日の成長を生み出したか
 */
export async function computeClusterDriftContribution(
  rangeDays: number = 7
): Promise<ClusterDriftContribution[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);

  // note_history から semantic_diff とクラスタを取得
  const rows = await db.all<{
    new_cluster_id: number | null;
    drift_sum: number;
  }>(sql`
    SELECT
      new_cluster_id,
      SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND new_cluster_id IS NOT NULL
      AND created_at >= ${startTimestamp}
    GROUP BY new_cluster_id
  `);

  if (rows.length === 0) {
    return [];
  }

  const totalDrift = rows.reduce((sum, r) => sum + (r.drift_sum ?? 0), 0);

  const contributions: ClusterDriftContribution[] = rows
    .filter((r) => r.new_cluster_id !== null)
    .map((r) => ({
      clusterId: r.new_cluster_id!,
      driftSum: round4(r.drift_sum ?? 0),
      ratio: totalDrift > 0 ? round4((r.drift_sum ?? 0) / totalDrift) : 0,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  return contributions;
}

/**
 * Drift 伝播を計算
 * 成長がどのクラスタからどのクラスタへ波及したか
 */
export async function computeDriftPropagation(
  rangeDays: number = 7
): Promise<DriftPropagation[]> {
  // クラスタ別 Drift 寄与を取得
  const contributions = await computeClusterDriftContribution(rangeDays);
  const driftMap = new Map<number, number>();
  for (const c of contributions) {
    driftMap.set(c.clusterId, c.ratio);
  }

  // クラスタ間の影響フローを取得
  const influenceFlow = await computeClusterInfluenceFlow();

  // 伝播を計算: drift_ratio × influence_weight
  const propagation: DriftPropagation[] = [];

  for (const flow of influenceFlow) {
    const sourceDrift = driftMap.get(flow.source) ?? 0;
    if (sourceDrift === 0) continue;

    // effective_influence = sourceDrift × influenceWeight
    const effectiveInfluence = round4(sourceDrift * flow.weight);
    if (effectiveInfluence >= 0.01) {
      propagation.push({
        sourceCluster: flow.source,
        targetCluster: flow.target,
        effectiveInfluence,
      });
    }
  }

  return propagation.sort((a, b) => b.effectiveInfluence - a.effectiveInfluence);
}

/**
 * Thinking Mode を判定
 */
export function detectThinkingMode(
  driftMetrics: DriftMetrics,
  contributions: ClusterDriftContribution[],
  propagation: DriftPropagation[]
): ThinkingMode {
  const { driftToday, state, trend } = driftMetrics;

  // 過熱・停滞状態
  if (state === "overheat") {
    return "rest";
  }
  if (state === "stagnation") {
    return "rest";
  }

  // Drift が小さい場合は休息
  if (driftToday < 0.05) {
    return "rest";
  }

  // 複数クラスタへの伝播が多い = exploration
  const uniqueTargets = new Set(propagation.map((p) => p.targetCluster));
  const uniqueSources = new Set(propagation.map((p) => p.sourceCluster));

  if (uniqueTargets.size >= 3 && trend === "rising") {
    return "exploration";
  }

  // 寄与が1クラスタに集中している = consolidation
  if (contributions.length > 0 && contributions[0].ratio > 0.6) {
    return "consolidation";
  }

  // 伝播が内部（source = target）中心 = consolidation
  const internalPropagation = propagation.filter((p) => p.sourceCluster === p.targetCluster);
  if (internalPropagation.length > propagation.length * 0.5) {
    return "consolidation";
  }

  // 大きな変化がある = refactoring
  if (driftToday > 0.3 && trend === "falling") {
    return "refactoring";
  }

  // デフォルト
  return "exploration";
}

/**
 * Thinking Season を判定
 */
export function detectThinkingSeason(
  contributions: ClusterDriftContribution[],
  clusterCount: number
): ThinkingSeason {
  if (contributions.length === 0) {
    return "balanced";
  }

  // 1クラスタが 50% 以上を占める = deep_focus
  if (contributions[0].ratio > 0.5) {
    return "deep_focus";
  }

  // 上位2クラスタで 70% 以上 = structuring
  if (contributions.length >= 2) {
    const top2Ratio = contributions[0].ratio + contributions[1].ratio;
    if (top2Ratio > 0.7) {
      return "structuring";
    }
  }

  // 3クラスタ以上に分散 = broad_search
  const activeClusterCount = contributions.filter((c) => c.ratio > 0.1).length;
  if (activeClusterCount >= 3) {
    return "broad_search";
  }

  return "balanced";
}

/**
 * Stability Metrics を取得
 */
export async function computeStabilityMetrics(
  date: string = new Date().toISOString().split("T")[0]
): Promise<StabilityMetrics> {
  const rows = await db.all<{
    cluster_id: number;
    cohesion: number;
    stability_score: number | null;
    note_count: number;
  }>(sql`
    SELECT cluster_id, cohesion, stability_score, note_count
    FROM cluster_dynamics
    WHERE date = ${date}
    ORDER BY cluster_id
  `);

  if (rows.length === 0) {
    return {
      avgCohesion: 0,
      avgStability: null,
      mostStableCluster: null,
      mostUnstableCluster: null,
      clusters: [],
    };
  }

  const clusters: ClusterStability[] = rows.map((r) => ({
    clusterId: r.cluster_id,
    cohesion: r.cohesion,
    stabilityScore: r.stability_score,
    noteCount: r.note_count,
  }));

  const avgCohesion = round4(rows.reduce((sum, r) => sum + r.cohesion, 0) / rows.length);

  const withStability = rows.filter((r) => r.stability_score !== null);
  const avgStability = withStability.length > 0
    ? round4(withStability.reduce((sum, r) => sum + (r.stability_score ?? 0), 0) / withStability.length)
    : null;

  // 最も安定（stability_score が小さい = 変化が少ない）
  const sortedByStability = [...withStability].sort(
    (a, b) => (a.stability_score ?? 0) - (b.stability_score ?? 0)
  );
  const mostStableCluster = sortedByStability.length > 0 ? sortedByStability[0].cluster_id : null;
  const mostUnstableCluster = sortedByStability.length > 0
    ? sortedByStability[sortedByStability.length - 1].cluster_id
    : null;

  return {
    avgCohesion,
    avgStability,
    mostStableCluster,
    mostUnstableCluster,
    clusters,
  };
}

/**
 * Dynamics Metrics を統合計算
 */
export async function computeDynamicsMetrics(
  rangeDays: number = 7
): Promise<DynamicsMetrics> {
  const driftMetrics = await computeDriftMetrics(rangeDays);
  const contributions = await computeClusterDriftContribution(rangeDays);
  const propagation = await computeDriftPropagation(rangeDays);

  const mode = detectThinkingMode(driftMetrics, contributions, propagation);
  const season = detectThinkingSeason(contributions, contributions.length);

  const topDriftCluster = contributions.length > 0 ? contributions[0].clusterId : null;

  return {
    clusterDriftContributions: contributions,
    topDriftCluster,
    driftPropagation: propagation,
    mode,
    season,
  };
}
