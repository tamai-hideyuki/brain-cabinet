/**
 * Snapshot Decision
 *
 * スナップショット作成の判定ロジック
 *
 * 方式: C + B ハイブリッド
 * - C: 有意な変化があった場合に作成
 * - B: 週次保険（7日経過で強制作成）
 */

import { db } from "../../../db/client";
import { sql } from "drizzle-orm";
import { cosineSimilarity, round4 } from "../../../utils/math";
import type { SnapshotTrigger } from "../../../db/schema";
import type { ChangeMetrics, SnapshotDecision, SnapshotClusterInfo } from "./types";

// 変化検出の閾値
const THRESHOLDS = {
  avgCohesionDelta: 0.1,     // 凝集度10%変化
  clusterCountDelta: 1,      // クラスタ数1以上変化
  notesAddedRatio: 0.2,      // ノート20%以上追加
  centroidDrift: 0.15,       // 重心が15%以上移動
  scheduledDays: 7,          // 週次保険（7日）
};

/**
 * 変化メトリクスを計算
 */
export function computeChangeMetrics(
  newClusters: SnapshotClusterInfo[],
  previousClusters: SnapshotClusterInfo[],
  newTotalNotes: number,
  previousTotalNotes: number
): ChangeMetrics {
  // 平均凝集度の変化
  const newAvgCohesion = newClusters.reduce(
    (sum, c) => sum + (c.cohesion ?? 0),
    0
  ) / (newClusters.length || 1);

  const prevAvgCohesion = previousClusters.reduce(
    (sum, c) => sum + (c.cohesion ?? 0),
    0
  ) / (previousClusters.length || 1);

  const avgCohesionDelta = Math.abs(newAvgCohesion - prevAvgCohesion);

  // クラスタ数の変化
  const clusterCountDelta = newClusters.length - previousClusters.length;

  // ノート追加比率
  const notesAddedRatio =
    previousTotalNotes > 0
      ? (newTotalNotes - previousTotalNotes) / previousTotalNotes
      : newTotalNotes > 0 ? 1 : 0;

  // 重心の平均移動量
  let centroidDrift = 0;
  if (previousClusters.length > 0 && newClusters.length > 0) {
    // 各新クラスタについて、最も近い旧クラスタとの距離を計算
    let driftSum = 0;
    for (const newCluster of newClusters) {
      let maxSimilarity = 0;
      for (const prevCluster of previousClusters) {
        const sim = cosineSimilarity(newCluster.centroid, prevCluster.centroid);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
        }
      }
      // 1 - similarity = drift
      driftSum += 1 - maxSimilarity;
    }
    centroidDrift = driftSum / newClusters.length;
  }

  return {
    avgCohesionDelta: round4(avgCohesionDelta),
    clusterCountDelta,
    notesAddedRatio: round4(notesAddedRatio),
    centroidDrift: round4(centroidDrift),
  };
}

/**
 * スナップショット作成判定
 */
export function shouldCreateSnapshot(
  metrics: ChangeMetrics,
  daysSinceLastSnapshot: number
): SnapshotDecision {
  // C: 有意な変化があった場合
  const significantChange =
    metrics.avgCohesionDelta > THRESHOLDS.avgCohesionDelta ||
    Math.abs(metrics.clusterCountDelta) >= THRESHOLDS.clusterCountDelta ||
    metrics.notesAddedRatio > THRESHOLDS.notesAddedRatio ||
    metrics.centroidDrift > THRESHOLDS.centroidDrift;

  if (significantChange) {
    return { should: true, trigger: "significant_change", metrics };
  }

  // B: 週次保険（7日経過）
  if (daysSinceLastSnapshot >= THRESHOLDS.scheduledDays) {
    return { should: true, trigger: "scheduled", metrics };
  }

  return { should: false, trigger: "scheduled", metrics };
}

/**
 * 最新スナップショットからの経過日数を取得
 */
export async function getDaysSinceLastSnapshot(): Promise<number> {
  const rows = await db.all<{ created_at: number }>(sql`
    SELECT created_at
    FROM clustering_snapshots
    WHERE is_current = 1
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (rows.length === 0) {
    // スナップショットが存在しない場合は無限日経過とみなす
    return Infinity;
  }

  const lastCreatedAt = rows[0].created_at * 1000; // Unix秒 -> ミリ秒
  const now = Date.now();
  const diffMs = now - lastCreatedAt;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)); // 日数
}

/**
 * changeScoreを計算（0〜1）
 * 複合メトリクスを単一スコアに変換
 */
export function computeChangeScore(metrics: ChangeMetrics): number {
  // 各メトリクスを正規化して加重平均
  const weights = {
    avgCohesionDelta: 0.3,
    clusterCountDelta: 0.2,
    notesAddedRatio: 0.2,
    centroidDrift: 0.3,
  };

  // clusterCountDelta は絶対値を使用し、10を最大とする
  const normalizedClusterDelta = Math.min(Math.abs(metrics.clusterCountDelta) / 10, 1);

  const score =
    weights.avgCohesionDelta * Math.min(metrics.avgCohesionDelta / THRESHOLDS.avgCohesionDelta, 1) +
    weights.clusterCountDelta * normalizedClusterDelta +
    weights.notesAddedRatio * Math.min(Math.abs(metrics.notesAddedRatio) / THRESHOLDS.notesAddedRatio, 1) +
    weights.centroidDrift * Math.min(metrics.centroidDrift / THRESHOLDS.centroidDrift, 1);

  return round4(Math.min(score, 1));
}
