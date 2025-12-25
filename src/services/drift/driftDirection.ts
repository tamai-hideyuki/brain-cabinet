/**
 * Drift Direction Tracking Service (v5.10)
 *
 * ドリフトの方向性を追跡し、思考の進化パターンを可視化
 *
 * - driftVector = newEmbedding - oldEmbedding
 * - driftDirection = normalize(driftVector)
 * - クラスターへのアラインメント（どの概念空間へ移動したか）
 * - クラスター間のフロー分析
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import {
  bufferToFloat32Array,
  cosineSimilarity,
  normalizeVector,
  round4,
} from "../../utils/math";

// ============================================================
// Types
// ============================================================

export type DriftVector = {
  noteId: string;
  historyId: number;
  driftScore: number;
  vector: number[];           // 正規化済みドリフトベクトル
  magnitude: number;          // ベクトルの大きさ（変化量）
};

export type ClusterAlignment = {
  clusterId: number;
  clusterName?: string;
  alignment: number;          // -1.0 ~ +1.0 (コサイン類似度)
  isApproaching: boolean;     // そのクラスターに近づいているか
};

export type DriftDirection = {
  noteId: string;
  historyId: number;
  driftScore: number;
  magnitude: number;
  trajectory: "expansion" | "contraction" | "pivot" | "lateral" | "stable";
  primaryDirection: ClusterAlignment | null;      // 最も近づいているクラスター
  secondaryDirection: ClusterAlignment | null;    // 2番目に近づいているクラスター
  movingAwayFrom: ClusterAlignment | null;        // 最も離れているクラスター
  allAlignments: ClusterAlignment[];
};

export type DriftFlow = {
  fromClusterId: number;
  toClusterId: number;
  count: number;
  avgDriftScore: number;
  avgAlignment: number;
};

export type ClusterDriftSummary = {
  clusterId: number;
  inflow: number;             // 流入ノート数
  outflow: number;            // 流出ノート数
  netFlow: number;            // 純フロー（inflow - outflow）
  avgIncomingAlignment: number;
  avgOutgoingAlignment: number;
};

export type GlobalDriftFlow = {
  analysisDate: string;
  totalDrifts: number;
  flows: DriftFlow[];
  clusterSummaries: ClusterDriftSummary[];
  dominantFlow: DriftFlow | null;
  insight: string;
};

// ============================================================
// Constants
// ============================================================

export const MIN_DRIFT_SCORE = 0.1;       // 分析対象とする最小ドリフトスコア
export const SIGNIFICANT_ALIGNMENT = 0.3; // 有意なアラインメント閾値

// ============================================================
// Data Fetching
// ============================================================

type HistoryWithEmbeddings = {
  historyId: number;
  noteId: string;
  driftScore: number;
  oldEmbedding: Buffer | null;
  newEmbedding: Buffer | null;
  oldClusterId: number | null;
  newClusterId: number | null;
  createdAt: number;
};

/**
 * ドリフトイベントのある履歴と埋め込みを取得
 */
export async function getDriftHistoriesWithEmbeddings(
  days: number = 90
): Promise<HistoryWithEmbeddings[]> {
  const startDate = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const rows = await db.all<{
    history_id: number;
    note_id: string;
    drift_score: string | null;
    old_embedding: Buffer | null;
    new_embedding: Buffer | null;
    old_cluster_id: number | null;
    new_cluster_id: number | null;
    created_at: number;
  }>(sql`
    SELECT
      nh.id as history_id,
      nh.note_id,
      nh.drift_score,
      nh.old_embedding,
      ne.embedding as new_embedding,
      nh.old_cluster_id,
      n.cluster_id as new_cluster_id,
      nh.created_at
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    LEFT JOIN note_embeddings ne ON nh.note_id = ne.note_id
    WHERE nh.drift_score IS NOT NULL
      AND nh.drift_score != ''
      AND CAST(nh.drift_score AS REAL) >= ${MIN_DRIFT_SCORE}
      AND nh.created_at >= ${startDate}
      AND nh.old_embedding IS NOT NULL
      AND ne.embedding IS NOT NULL
    ORDER BY nh.created_at DESC
  `);

  return rows.map((r) => ({
    historyId: r.history_id,
    noteId: r.note_id,
    driftScore: r.drift_score ? parseFloat(r.drift_score) : 0,
    oldEmbedding: r.old_embedding,
    newEmbedding: r.new_embedding,
    oldClusterId: r.old_cluster_id,
    newClusterId: r.new_cluster_id,
    createdAt: r.created_at,
  }));
}

/**
 * 全クラスターのセントロイドを取得
 */
export async function getClusterCentroids(): Promise<
  Map<number, { centroid: number[]; name?: string }>
> {
  const rows = await db.all<{
    cluster_id: number;
    centroid: Buffer;
  }>(sql`
    SELECT cluster_id, centroid
    FROM cluster_dynamics
    WHERE date = (SELECT MAX(date) FROM cluster_dynamics)
  `);

  const centroids = new Map<number, { centroid: number[]; name?: string }>();
  for (const row of rows) {
    const centroid = bufferToFloat32Array(row.centroid);
    if (centroid.length > 0) {
      centroids.set(row.cluster_id, { centroid });
    }
  }

  return centroids;
}

// ============================================================
// Drift Vector Calculation
// ============================================================

/**
 * ドリフトベクトルを計算
 *
 * driftVector = newEmbedding - oldEmbedding
 */
export function calculateDriftVector(
  oldEmbedding: number[],
  newEmbedding: number[]
): { vector: number[]; magnitude: number } {
  if (oldEmbedding.length !== newEmbedding.length || oldEmbedding.length === 0) {
    return { vector: [], magnitude: 0 };
  }

  // 差分ベクトル
  const diff = newEmbedding.map((v, i) => v - oldEmbedding[i]);

  // 大きさ
  const magnitude = Math.sqrt(diff.reduce((sum, v) => sum + v * v, 0));

  // 正規化
  const vector = magnitude > 0 ? diff.map((v) => v / magnitude) : diff;

  return { vector, magnitude: round4(magnitude) };
}

/**
 * ドリフトベクトルとクラスターセントロイドのアラインメントを計算
 */
export function calculateClusterAlignments(
  driftVector: number[],
  centroids: Map<number, { centroid: number[]; name?: string }>
): ClusterAlignment[] {
  if (driftVector.length === 0) return [];

  const alignments: ClusterAlignment[] = [];

  for (const [clusterId, { centroid, name }] of centroids) {
    // ドリフトベクトルとセントロイドのコサイン類似度
    // 正の値 = そのクラスターの方向へ移動
    // 負の値 = そのクラスターから離れる方向へ移動
    const alignment = cosineSimilarity(driftVector, centroid);

    alignments.push({
      clusterId,
      clusterName: name,
      alignment: round4(alignment),
      isApproaching: alignment > 0,
    });
  }

  return alignments.sort((a, b) => b.alignment - a.alignment);
}

/**
 * 軌道タイプを判定
 */
export function determineTrajectory(
  driftScore: number,
  magnitude: number,
  primaryAlignment: number | null,
  clusterChanged: boolean
): "expansion" | "contraction" | "pivot" | "lateral" | "stable" {
  // 変化が小さい場合は安定
  if (driftScore < 0.15 || magnitude < 0.05) {
    return "stable";
  }

  // クラスター変更はピボット
  if (clusterChanged) {
    return "pivot";
  }

  // 強いアラインメントがある場合
  if (primaryAlignment !== null) {
    if (primaryAlignment > SIGNIFICANT_ALIGNMENT) {
      return "expansion";  // 特定方向へ拡大
    }
    if (primaryAlignment < -SIGNIFICANT_ALIGNMENT) {
      return "contraction";  // 特定方向から縮小
    }
  }

  // アラインメントが中立的な場合は横方向の移動
  return "lateral";
}

// ============================================================
// Single Note Analysis
// ============================================================

/**
 * 特定ノートのドリフト方向を分析
 */
export async function analyzeDriftDirection(
  noteId: string
): Promise<DriftDirection | null> {
  const histories = await getDriftHistoriesWithEmbeddings(365);
  const noteHistory = histories.find((h) => h.noteId === noteId);

  if (!noteHistory || !noteHistory.oldEmbedding || !noteHistory.newEmbedding) {
    return null;
  }

  const centroids = await getClusterCentroids();

  const oldEmb = bufferToFloat32Array(noteHistory.oldEmbedding);
  const newEmb = bufferToFloat32Array(noteHistory.newEmbedding);

  const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

  if (vector.length === 0) {
    return null;
  }

  const allAlignments = calculateClusterAlignments(vector, centroids);

  // 最も近づいているクラスター
  const primaryDirection = allAlignments.length > 0 && allAlignments[0].alignment > 0
    ? allAlignments[0]
    : null;

  // 2番目に近づいているクラスター
  const secondaryDirection = allAlignments.length > 1 && allAlignments[1].alignment > 0
    ? allAlignments[1]
    : null;

  // 最も離れているクラスター
  const movingAwayFrom = allAlignments.length > 0 && allAlignments[allAlignments.length - 1].alignment < 0
    ? allAlignments[allAlignments.length - 1]
    : null;

  const clusterChanged =
    noteHistory.oldClusterId !== null &&
    noteHistory.newClusterId !== null &&
    noteHistory.oldClusterId !== noteHistory.newClusterId;

  const trajectory = determineTrajectory(
    noteHistory.driftScore,
    magnitude,
    primaryDirection?.alignment ?? null,
    clusterChanged
  );

  return {
    noteId,
    historyId: noteHistory.historyId,
    driftScore: round4(noteHistory.driftScore),
    magnitude,
    trajectory,
    primaryDirection,
    secondaryDirection,
    movingAwayFrom,
    allAlignments,
  };
}

/**
 * 特定履歴IDのドリフト方向を分析
 */
export async function analyzeDriftDirectionByHistoryId(
  historyId: number
): Promise<DriftDirection | null> {
  const row = await db.get<{
    note_id: string;
    drift_score: string | null;
    old_embedding: Buffer | null;
    old_cluster_id: number | null;
  }>(sql`
    SELECT note_id, drift_score, old_embedding, old_cluster_id
    FROM note_history
    WHERE id = ${historyId}
  `);

  if (!row || !row.old_embedding) {
    return null;
  }

  // 現在の埋め込みを取得
  const embRow = await db.get<{
    embedding: Buffer;
    cluster_id: number | null;
  }>(sql`
    SELECT ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
    WHERE ne.note_id = ${row.note_id}
  `);

  if (!embRow) {
    return null;
  }

  const centroids = await getClusterCentroids();

  const oldEmb = bufferToFloat32Array(row.old_embedding);
  const newEmb = bufferToFloat32Array(embRow.embedding);

  const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

  if (vector.length === 0) {
    return null;
  }

  const allAlignments = calculateClusterAlignments(vector, centroids);

  const primaryDirection = allAlignments.length > 0 && allAlignments[0].alignment > 0
    ? allAlignments[0]
    : null;

  const secondaryDirection = allAlignments.length > 1 && allAlignments[1].alignment > 0
    ? allAlignments[1]
    : null;

  const movingAwayFrom = allAlignments.length > 0 && allAlignments[allAlignments.length - 1].alignment < 0
    ? allAlignments[allAlignments.length - 1]
    : null;

  const clusterChanged =
    row.old_cluster_id !== null &&
    embRow.cluster_id !== null &&
    row.old_cluster_id !== embRow.cluster_id;

  const driftScore = row.drift_score ? parseFloat(row.drift_score) : 0;

  const trajectory = determineTrajectory(
    driftScore,
    magnitude,
    primaryDirection?.alignment ?? null,
    clusterChanged
  );

  return {
    noteId: row.note_id,
    historyId,
    driftScore: round4(driftScore),
    magnitude,
    trajectory,
    primaryDirection,
    secondaryDirection,
    movingAwayFrom,
    allAlignments,
  };
}

// ============================================================
// Flow Analysis
// ============================================================

/**
 * クラスター間のドリフトフローを分析
 */
export async function analyzeDriftFlows(
  days: number = 90
): Promise<GlobalDriftFlow> {
  const histories = await getDriftHistoriesWithEmbeddings(days);
  const centroids = await getClusterCentroids();

  // フローを集計
  const flowMap = new Map<string, { count: number; totalScore: number; totalAlignment: number }>();
  const clusterStats = new Map<number, {
    inflow: number;
    outflow: number;
    incomingAlignments: number[];
    outgoingAlignments: number[];
  }>();

  let totalDrifts = 0;

  for (const history of histories) {
    if (!history.oldEmbedding || !history.newEmbedding) continue;
    if (history.oldClusterId === null || history.newClusterId === null) continue;

    totalDrifts++;

    const oldEmb = bufferToFloat32Array(history.oldEmbedding);
    const newEmb = bufferToFloat32Array(history.newEmbedding);
    const { vector } = calculateDriftVector(oldEmb, newEmb);

    if (vector.length === 0) continue;

    // 新クラスターへのアラインメントを計算
    const newClusterCentroid = centroids.get(history.newClusterId);
    const alignment = newClusterCentroid
      ? cosineSimilarity(vector, newClusterCentroid.centroid)
      : 0;

    // フローを集計（クラスター変更がある場合のみ）
    if (history.oldClusterId !== history.newClusterId) {
      const flowKey = `${history.oldClusterId}->${history.newClusterId}`;
      const existing = flowMap.get(flowKey) ?? { count: 0, totalScore: 0, totalAlignment: 0 };
      flowMap.set(flowKey, {
        count: existing.count + 1,
        totalScore: existing.totalScore + history.driftScore,
        totalAlignment: existing.totalAlignment + alignment,
      });

      // クラスター統計
      const fromStats = clusterStats.get(history.oldClusterId) ?? {
        inflow: 0, outflow: 0, incomingAlignments: [], outgoingAlignments: []
      };
      fromStats.outflow++;
      fromStats.outgoingAlignments.push(alignment);
      clusterStats.set(history.oldClusterId, fromStats);

      const toStats = clusterStats.get(history.newClusterId) ?? {
        inflow: 0, outflow: 0, incomingAlignments: [], outgoingAlignments: []
      };
      toStats.inflow++;
      toStats.incomingAlignments.push(alignment);
      clusterStats.set(history.newClusterId, toStats);
    }
  }

  // フローをリストに変換
  const flows: DriftFlow[] = [];
  for (const [key, data] of flowMap) {
    const [from, to] = key.split("->").map(Number);
    flows.push({
      fromClusterId: from,
      toClusterId: to,
      count: data.count,
      avgDriftScore: round4(data.totalScore / data.count),
      avgAlignment: round4(data.totalAlignment / data.count),
    });
  }

  flows.sort((a, b) => b.count - a.count);

  // クラスターサマリーを生成
  const clusterSummaries: ClusterDriftSummary[] = [];
  for (const [clusterId, stats] of clusterStats) {
    const avgIncoming = stats.incomingAlignments.length > 0
      ? stats.incomingAlignments.reduce((a, b) => a + b, 0) / stats.incomingAlignments.length
      : 0;
    const avgOutgoing = stats.outgoingAlignments.length > 0
      ? stats.outgoingAlignments.reduce((a, b) => a + b, 0) / stats.outgoingAlignments.length
      : 0;

    clusterSummaries.push({
      clusterId,
      inflow: stats.inflow,
      outflow: stats.outflow,
      netFlow: stats.inflow - stats.outflow,
      avgIncomingAlignment: round4(avgIncoming),
      avgOutgoingAlignment: round4(avgOutgoing),
    });
  }

  clusterSummaries.sort((a, b) => b.netFlow - a.netFlow);

  // 最も多いフロー
  const dominantFlow = flows.length > 0 ? flows[0] : null;

  // インサイト生成
  const insight = generateFlowInsight(flows, clusterSummaries, totalDrifts);

  return {
    analysisDate: new Date().toISOString().split("T")[0],
    totalDrifts,
    flows,
    clusterSummaries,
    dominantFlow,
    insight,
  };
}

/**
 * フローインサイトを生成
 */
function generateFlowInsight(
  flows: DriftFlow[],
  summaries: ClusterDriftSummary[],
  totalDrifts: number
): string {
  if (totalDrifts === 0) {
    return "分析対象のドリフトデータがありません。";
  }

  const parts: string[] = [];

  // 最も多いフロー
  if (flows.length > 0) {
    const top = flows[0];
    parts.push(
      `最も多い思考の流れはクラスター${top.fromClusterId}から${top.toClusterId}へ（${top.count}件）。`
    );
  }

  // 成長しているクラスター
  const growing = summaries.filter((s) => s.netFlow > 0);
  if (growing.length > 0) {
    const topGrowing = growing[0];
    parts.push(
      `クラスター${topGrowing.clusterId}が最も成長中（純流入+${topGrowing.netFlow}）。`
    );
  }

  // 縮小しているクラスター
  const shrinking = summaries.filter((s) => s.netFlow < 0);
  if (shrinking.length > 0) {
    const topShrinking = shrinking[shrinking.length - 1];
    parts.push(
      `クラスター${topShrinking.clusterId}からの流出が目立ちます。`
    );
  }

  if (parts.length === 0) {
    return "ドリフトパターンは安定しています。";
  }

  return parts.join(" ");
}

// ============================================================
// Recent Drift Analysis
// ============================================================

/**
 * 最近のドリフト方向を分析
 */
export async function analyzeRecentDrifts(
  days: number = 30,
  limit: number = 20
): Promise<DriftDirection[]> {
  const histories = await getDriftHistoriesWithEmbeddings(days);
  const centroids = await getClusterCentroids();

  const results: DriftDirection[] = [];

  for (const history of histories.slice(0, limit)) {
    if (!history.oldEmbedding || !history.newEmbedding) continue;

    const oldEmb = bufferToFloat32Array(history.oldEmbedding);
    const newEmb = bufferToFloat32Array(history.newEmbedding);

    const { vector, magnitude } = calculateDriftVector(oldEmb, newEmb);

    if (vector.length === 0) continue;

    const allAlignments = calculateClusterAlignments(vector, centroids);

    const primaryDirection = allAlignments.length > 0 && allAlignments[0].alignment > 0
      ? allAlignments[0]
      : null;

    const secondaryDirection = allAlignments.length > 1 && allAlignments[1].alignment > 0
      ? allAlignments[1]
      : null;

    const movingAwayFrom = allAlignments.length > 0 && allAlignments[allAlignments.length - 1].alignment < 0
      ? allAlignments[allAlignments.length - 1]
      : null;

    const clusterChanged =
      history.oldClusterId !== null &&
      history.newClusterId !== null &&
      history.oldClusterId !== history.newClusterId;

    const trajectory = determineTrajectory(
      history.driftScore,
      magnitude,
      primaryDirection?.alignment ?? null,
      clusterChanged
    );

    results.push({
      noteId: history.noteId,
      historyId: history.historyId,
      driftScore: round4(history.driftScore),
      magnitude,
      trajectory,
      primaryDirection,
      secondaryDirection,
      movingAwayFrom,
      allAlignments,
    });
  }

  return results;
}

/**
 * ドリフト方向のサマリーを生成
 */
export async function generateDriftDirectionSummary(
  days: number = 30
): Promise<{
  totalDrifts: number;
  trajectoryBreakdown: Record<string, number>;
  dominantDirection: ClusterAlignment | null;
  insight: string;
}> {
  const recentDrifts = await analyzeRecentDrifts(days, 100);

  if (recentDrifts.length === 0) {
    return {
      totalDrifts: 0,
      trajectoryBreakdown: {},
      dominantDirection: null,
      insight: "分析対象のドリフトデータがありません。",
    };
  }

  // 軌道タイプの集計
  const trajectoryBreakdown: Record<string, number> = {
    expansion: 0,
    contraction: 0,
    pivot: 0,
    lateral: 0,
    stable: 0,
  };

  for (const drift of recentDrifts) {
    trajectoryBreakdown[drift.trajectory]++;
  }

  // 最も多い方向を集計
  const directionCounts = new Map<number, { count: number; totalAlignment: number }>();
  for (const drift of recentDrifts) {
    if (drift.primaryDirection) {
      const existing = directionCounts.get(drift.primaryDirection.clusterId) ?? { count: 0, totalAlignment: 0 };
      directionCounts.set(drift.primaryDirection.clusterId, {
        count: existing.count + 1,
        totalAlignment: existing.totalAlignment + drift.primaryDirection.alignment,
      });
    }
  }

  let dominantDirection: ClusterAlignment | null = null;
  let maxCount = 0;
  for (const [clusterId, data] of directionCounts) {
    if (data.count > maxCount) {
      maxCount = data.count;
      dominantDirection = {
        clusterId,
        alignment: round4(data.totalAlignment / data.count),
        isApproaching: true,
      };
    }
  }

  // インサイト生成
  const insight = generateDirectionInsight(trajectoryBreakdown, dominantDirection, recentDrifts.length);

  return {
    totalDrifts: recentDrifts.length,
    trajectoryBreakdown,
    dominantDirection,
    insight,
  };
}

function generateDirectionInsight(
  breakdown: Record<string, number>,
  dominant: ClusterAlignment | null,
  total: number
): string {
  const parts: string[] = [];

  // 最も多い軌道タイプ
  const sortedTrajectories = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (sortedTrajectories.length > 0 && sortedTrajectories[0][1] > 0) {
    const [type, count] = sortedTrajectories[0];
    const percentage = Math.round((count / total) * 100);

    const typeDescriptions: Record<string, string> = {
      expansion: "思考が拡大方向に進んでいます",
      contraction: "思考が収束・深化しています",
      pivot: "思考の方向転換が多く見られます",
      lateral: "新しい領域を横断的に探索しています",
      stable: "思考が安定した状態です",
    };

    parts.push(`${typeDescriptions[type]}（${percentage}%）。`);
  }

  // 支配的な方向
  if (dominant) {
    parts.push(`全体としてクラスター${dominant.clusterId}の方向へ収束傾向があります。`);
  }

  if (parts.length === 0) {
    return "ドリフトパターンは多様です。";
  }

  return parts.join(" ");
}
