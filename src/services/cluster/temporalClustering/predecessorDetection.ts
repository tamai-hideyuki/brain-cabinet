/**
 * Predecessor Detection
 *
 * クラスタの継承関係（predecessor）を判定するロジック
 *
 * 設計方針:
 * - 固定閾値（0.7）ではなく、相対評価 + ゾーン分け
 * - 「差（gap）」を評価に入れて曖昧ゾーンを許容
 * - sizeRatio で異常なサイズ変化を検出
 * - confidence_score と confidence_label の二層構造
 */

import { cosineSimilarity, round4 } from "../../../utils/math";
import type { ConfidenceLabel } from "../../../db/schema";
import type { LineageCandidate, SnapshotClusterInfo } from "./types";

// sizeRatioの許容範囲（0.5〜2.0 = 半分〜2倍まで）
const SIZE_RATIO_MIN = 0.5;
const SIZE_RATIO_MAX = 2.0;

/**
 * 単一クラスタのpredecessorを判定
 *
 * @param newCentroid 新クラスタの重心
 * @param newSize 新クラスタのサイズ
 * @param previousClusters 前スナップショットのクラスタ群
 * @returns predecessor判定結果（なければnull）
 */
export function determinePredecessor(
  newCentroid: number[],
  newSize: number,
  previousClusters: SnapshotClusterInfo[]
): LineageCandidate | null {
  if (previousClusters.length === 0) {
    return {
      predecessorClusterId: null,
      similarity: 0,
      confidenceScore: 0,
      confidenceLabel: "none",
    };
  }

  // 全predecessorとの類似度とsizeRatioを計算
  const candidates = previousClusters.map((prev) => ({
    clusterId: prev.id,
    similarity: cosineSimilarity(newCentroid, prev.centroid),
    sizeRatio: prev.size > 0 ? newSize / prev.size : 1.0,
    prevSize: prev.size,
  }));

  // 類似度でソート（降順）
  candidates.sort((a, b) => b.similarity - a.similarity);

  const best = candidates[0];
  const secondBest = candidates[1];

  // 相対評価：2位との差も考慮
  const gap = secondBest ? best.similarity - secondBest.similarity : 1.0;

  // sizeRatioが許容範囲内かチェック
  const sizeRatioValid =
    best.sizeRatio >= SIZE_RATIO_MIN && best.sizeRatio <= SIZE_RATIO_MAX;

  // ゾーン分け（固定閾値ではなく、複合条件）
  const { confidenceScore, confidenceLabel } = determineConfidence(
    best.similarity,
    gap,
    sizeRatioValid
  );

  if (confidenceLabel === "none") {
    return {
      predecessorClusterId: null,
      similarity: best.similarity,
      confidenceScore,
      confidenceLabel,
    };
  }

  return {
    predecessorClusterId: best.clusterId,
    similarity: round4(best.similarity),
    confidenceScore: round4(confidenceScore),
    confidenceLabel,
  };
}

/**
 * confidence判定（相対評価 + ゾーン分け + sizeRatio）
 *
 * 判定基準（K-Meansのランダム性を考慮して緩和）:
 * - high: 高類似度(≥0.60) + 明確な差(≥0.10) + サイズ比率正常 → 確実に継承
 * - medium: 中程度の類似度(≥0.40) + そこそこの差(≥0.05) → おそらく継承
 * - low: 低めだが関連はありそう(≥0.20) → 弱い継承
 * - none: 関連なし(<0.20) → 新規クラスタ
 *
 * sizeRatioが異常（0.5未満 or 2.0超）の場合:
 * - high → medium に降格
 * - medium → low に降格
 * - low/none → そのまま
 *
 * NOTE: K-Meansは毎回ランダム初期化されるため、同じデータでも
 * クラスタ重心が大きく変わることがある。そのため閾値は低めに設定。
 */
function determineConfidence(
  similarity: number,
  gap: number,
  sizeRatioValid: boolean
): { confidenceScore: number; confidenceLabel: ConfidenceLabel } {
  // High: 確実に継承（sizeRatioも正常な場合のみ）
  if (similarity >= 0.60 && gap >= 0.10 && sizeRatioValid) {
    const score = similarity * 0.7 + gap * 0.3;
    return { confidenceScore: Math.min(score, 1.0), confidenceLabel: "high" };
  }

  // High条件だがsizeRatio異常 → Medium に降格
  if (similarity >= 0.60 && gap >= 0.10 && !sizeRatioValid) {
    const score = similarity * 0.6 + gap * 0.3;
    return { confidenceScore: score, confidenceLabel: "medium" };
  }

  // Medium: おそらく継承
  if (similarity >= 0.40 && gap >= 0.05) {
    // sizeRatio異常ならLowに降格
    if (!sizeRatioValid) {
      const score = similarity * 0.4 + gap * 0.2;
      return { confidenceScore: score, confidenceLabel: "low" };
    }
    const score = similarity * 0.6 + gap * 0.4;
    return { confidenceScore: score, confidenceLabel: "medium" };
  }

  // Low: 弱い継承
  if (similarity >= 0.20) {
    const score = similarity * 0.5 + gap * 0.2;
    return { confidenceScore: score, confidenceLabel: "low" };
  }

  // None: 新規クラスタ
  return { confidenceScore: similarity, confidenceLabel: "none" };
}

/**
 * 全クラスタのpredecessorを一括判定
 *
 * @param newClusters 新スナップショットのクラスタ群
 * @param previousClusters 前スナップショットのクラスタ群
 * @returns クラスタID -> LineageCandidate のマップ
 */
export function determineAllPredecessors(
  newClusters: SnapshotClusterInfo[],
  previousClusters: SnapshotClusterInfo[]
): Map<number, LineageCandidate> {
  const lineages = new Map<number, LineageCandidate>();

  for (const newCluster of newClusters) {
    const lineage = determinePredecessor(
      newCluster.centroid,
      newCluster.size,
      previousClusters
    );
    if (lineage) {
      lineages.set(newCluster.id, lineage);
    }
  }

  return lineages;
}

/**
 * 逆引き：同じpredecessorを持つクラスタをグループ化
 * （分裂検出用）
 */
export function groupByPredecessor(
  lineages: Map<number, LineageCandidate>
): Map<number | null, number[]> {
  const groups = new Map<number | null, number[]>();

  for (const [newClusterId, lineage] of lineages) {
    const predId = lineage.predecessorClusterId;
    const list = groups.get(predId) ?? [];
    list.push(newClusterId);
    groups.set(predId, list);
  }

  return groups;
}
