/**
 * PTM Snapshot Writer
 *
 * 全メトリクスを統合して PtmSnapshot を生成・保存
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { computeCoreMetrics } from "./core";
import { computeInfluenceMetrics } from "./influence";
import { computeDriftMetrics, computeDynamicsMetrics, computeStabilityMetrics } from "./dynamics";
import type { PtmSnapshot, PtmInsightResponse } from "./types";

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * PTM Snapshot を生成（保存はしない）
 */
export async function generatePtmSnapshot(
  date: string = new Date().toISOString().split("T")[0]
): Promise<PtmSnapshot> {
  // 各メトリクスを並列計算
  const [core, influence, drift, dynamics, stability] = await Promise.all([
    computeCoreMetrics(),
    computeInfluenceMetrics(),
    computeDriftMetrics(30),
    computeDynamicsMetrics(7),
    computeStabilityMetrics(date),
  ]);

  const snapshot: PtmSnapshot = {
    date,

    // Core
    totalNotes: core.totalNotes,
    clusterCount: core.clusterCount,
    dominantCluster: core.dominantCluster,
    clusterWeights: core.clusterWeights,

    // Drift
    driftToday: round4(drift.driftToday),
    driftEma: round4(drift.driftEma),
    growthAngle: round4(drift.growthAngle),
    trend: drift.trend,
    state: drift.state,

    // Influence
    totalInfluenceEdges: influence.totalEdges,
    primaryHubNote: influence.primaryHubNote,
    topInfluencers: influence.topInfluencers.slice(0, 3),
    topClustersByDrift: dynamics.clusterDriftContributions.slice(0, 3),

    // Dynamics
    mode: dynamics.mode,
    season: dynamics.season,

    // Stability
    avgCohesion: stability.avgCohesion,
    avgStability: stability.avgStability,

    // Meta
    capturedAt: new Date().toISOString(),
  };

  return snapshot;
}

/**
 * PTM Snapshot を保存
 */
export async function capturePtmSnapshot(
  date: string = new Date().toISOString().split("T")[0]
): Promise<PtmSnapshot> {
  const snapshot = await generatePtmSnapshot(date);

  // 既存があれば削除
  await db.run(sql`DELETE FROM ptm_snapshots WHERE date(captured_at) = ${date}`);

  // 保存
  const now = Math.floor(Date.now() / 1000);
  await db.run(sql`
    INSERT INTO ptm_snapshots
      (captured_at, cluster_strengths, imbalance_score, summary)
    VALUES
      (${now}, ${JSON.stringify(snapshot.clusterWeights)}, ${1 - snapshot.avgCohesion}, ${JSON.stringify(snapshot)})
  `);

  return snapshot;
}

/**
 * 最新の PTM Snapshot を取得
 */
export async function getLatestPtmSnapshot(): Promise<PtmSnapshot | null> {
  const rows = await db.all<{
    summary: string;
  }>(sql`
    SELECT summary
    FROM ptm_snapshots
    ORDER BY captured_at DESC
    LIMIT 1
  `);

  if (rows.length === 0) {
    return null;
  }

  try {
    return JSON.parse(rows[0].summary) as PtmSnapshot;
  } catch {
    return null;
  }
}

/**
 * PTM Snapshot 履歴を取得
 */
export async function getPtmSnapshotHistory(
  limit: number = 7
): Promise<PtmSnapshot[]> {
  const rows = await db.all<{
    summary: string;
  }>(sql`
    SELECT summary
    FROM ptm_snapshots
    ORDER BY captured_at DESC
    LIMIT ${limit}
  `);

  const snapshots: PtmSnapshot[] = [];
  for (const row of rows) {
    try {
      snapshots.push(JSON.parse(row.summary) as PtmSnapshot);
    } catch {
      // skip invalid
    }
  }

  return snapshots;
}

/**
 * GPT向けインサイトを生成
 */
export async function generatePtmInsight(
  date: string = new Date().toISOString().split("T")[0]
): Promise<PtmInsightResponse> {
  const snapshot = await generatePtmSnapshot(date);

  // インタープリテーションを生成
  const interpretation = {
    growthSummary: generateGrowthSummary(snapshot),
    influenceSummary: generateInfluenceSummary(snapshot),
    stabilitySummary: generateStabilitySummary(snapshot),
    recommendation: generateRecommendation(snapshot),
  };

  return {
    date,
    snapshot,
    interpretation,
  };
}

function generateGrowthSummary(snapshot: PtmSnapshot): string {
  const { driftToday, driftEma, trend, state, mode, season } = snapshot;

  if (state === "overheat") {
    return `思考が過熱状態です（drift: ${driftToday.toFixed(2)}）。一度立ち止まって整理する時間を取りましょう。`;
  }

  if (state === "stagnation") {
    return `思考が停滞しています（drift: ${driftToday.toFixed(2)}）。新しい情報に触れてみましょう。`;
  }

  if (trend === "rising") {
    return `成長が加速しています（角度: ${snapshot.growthAngle.toFixed(1)}°）。${modeToJapanese(mode)}フェーズで${seasonToJapanese(season)}型の活動です。`;
  }

  if (trend === "falling") {
    return `成長ペースが落ち着いています。学んだことが定着するフェーズです。`;
  }

  return `安定した成長リズムです（EMA: ${driftEma.toFixed(3)}）。`;
}

function generateInfluenceSummary(snapshot: PtmSnapshot): string {
  const { totalInfluenceEdges, primaryHubNote, topInfluencers } = snapshot;

  if (totalInfluenceEdges === 0) {
    return "影響関係はまだ構築されていません。";
  }

  if (topInfluencers.length > 0) {
    const topWeight = topInfluencers[0].outWeight;
    if (topWeight > 1.5) {
      return `${totalInfluenceEdges}件の影響関係があり、特定のノートが中心的な役割を果たしています。`;
    }
  }

  return `${totalInfluenceEdges}件の影響関係があり、知識が広く連携しています。`;
}

function generateStabilitySummary(snapshot: PtmSnapshot): string {
  const { avgCohesion, avgStability, clusterCount } = snapshot;

  if (avgCohesion > 0.8) {
    return `クラスタの凝集度が高く（${avgCohesion.toFixed(2)}）、思考が明確に整理されています。`;
  }

  if (avgCohesion < 0.7) {
    return `クラスタの凝集度がやや低め（${avgCohesion.toFixed(2)}）です。ノートの分類を見直すと良いかもしれません。`;
  }

  return `${clusterCount}クラスタで安定しています（平均凝集度: ${avgCohesion.toFixed(2)}）。`;
}

function generateRecommendation(snapshot: PtmSnapshot): string {
  const { mode, season, state, trend, topClustersByDrift } = snapshot;

  if (state === "overheat") {
    return "今日は振り返りと整理に時間を使いましょう。新しいインプットは控えめに。";
  }

  if (state === "stagnation") {
    return "新しいテーマに触れてみましょう。異なる視点からのアプローチが効果的です。";
  }

  if (mode === "exploration" && season === "broad_search") {
    return "探索が広がっています。気になったテーマを1つ選んで深掘りしてみましょう。";
  }

  if (mode === "consolidation" && season === "deep_focus") {
    const topCluster = topClustersByDrift.length > 0 ? topClustersByDrift[0].clusterId : null;
    if (topCluster !== null) {
      return `クラスタ${topCluster}に集中しています。関連するノート同士をつなげてみましょう。`;
    }
    return "統合フェーズです。既存のノートを振り返り、つながりを見つけましょう。";
  }

  if (trend === "rising") {
    return "良い成長リズムです。この調子で続けましょう。";
  }

  return "安定した成長を続けています。今日も良いノートを書きましょう。";
}

function modeToJapanese(mode: string): string {
  const map: Record<string, string> = {
    exploration: "探索",
    consolidation: "統合",
    refactoring: "再構成",
    rest: "休息",
  };
  return map[mode] ?? mode;
}

function seasonToJapanese(season: string): string {
  const map: Record<string, string> = {
    deep_focus: "集中",
    broad_search: "探索",
    structuring: "構造化",
    balanced: "バランス",
  };
  return map[season] ?? season;
}
