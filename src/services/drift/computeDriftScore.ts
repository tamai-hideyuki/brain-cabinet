/**
 * Drift Score 計算サービス (v3 Spec + v5.6 拡張)
 *
 * Drift = semantic_diff × (1 + cluster_jump_bonus + change_type_modifier)
 *
 * - semantic_diff: 内容の変化量
 * - cluster_jump: 思考領域の移動（カテゴリー変化）
 * - change_type_modifier: 変化タイプに応じた重み付け (v5.6)
 */

import type { SemanticChangeType } from "../../db/schema";

export type DriftScoreInput = {
  semanticDiff: number; // 0.0〜1.0
  oldClusterId: number | null;
  newClusterId: number | null;
  changeType?: SemanticChangeType | null;  // v5.6: 変化タイプ
};

export type DriftScoreOutput = {
  driftScore: number;
  clusterJump: boolean;
  clusterJumpBonus: number;
  changeTypeModifier: number;  // v5.6: 変化タイプによる修正
};

/**
 * 変化タイプに応じた重み付けを返す
 *
 * - pivot: +0.3 (方向転換は大きなドリフト)
 * - expansion: +0.1 (拡張は中程度のドリフト)
 * - contraction: 0 (縮小は中立)
 * - deepening: -0.1 (深化は安定的)
 * - refinement: -0.2 (洗練はほぼ変化なし)
 */
export function getChangeTypeModifier(changeType: SemanticChangeType | null | undefined): number {
  if (!changeType) return 0;

  switch (changeType) {
    case "pivot":
      return 0.3;       // 方向転換は大きなドリフトとして扱う
    case "expansion":
      return 0.1;       // 拡張は中程度のドリフト
    case "contraction":
      return 0;         // 縮小は中立
    case "deepening":
      return -0.1;      // 深化は安定的（ドリフトを抑制）
    case "refinement":
      return -0.2;      // 洗練はほぼ変化なし
    default:
      return 0;
  }
}

/**
 * Drift Score を計算する
 *
 * @example
 * computeDriftScore({ semanticDiff: 0.3, oldClusterId: 2, newClusterId: 5 })
 * // => { driftScore: 0.45, clusterJump: true, clusterJumpBonus: 0.5, changeTypeModifier: 0 }
 *
 * @example
 * computeDriftScore({ semanticDiff: 0.3, oldClusterId: 2, newClusterId: 2, changeType: "pivot" })
 * // => { driftScore: 0.39, clusterJump: false, clusterJumpBonus: 0, changeTypeModifier: 0.3 }
 */
export function computeDriftScore(input: DriftScoreInput): DriftScoreOutput {
  const { semanticDiff, oldClusterId, newClusterId, changeType } = input;

  // クラスター変化（ジャンプ）判定
  const clusterJump =
    oldClusterId !== null &&
    newClusterId !== null &&
    oldClusterId !== newClusterId;

  const clusterJumpBonus = clusterJump ? 0.5 : 0;

  // v5.6: 変化タイプによる修正
  const changeTypeModifier = getChangeTypeModifier(changeType);

  // Drift Score 計算式（修正後も0〜1.5の範囲に収める）
  const rawScore = semanticDiff * (1 + clusterJumpBonus + changeTypeModifier);
  const driftScore = Math.max(0, Math.min(1.5, rawScore));

  return {
    driftScore,
    clusterJump,
    clusterJumpBonus,
    changeTypeModifier,
  };
}

/**
 * Drift Event Type を判定
 */
export type DriftEventType = "medium" | "large" | "cluster_shift" | null;

export const DRIFT_THRESHOLD = 0.25; // medium drift
export const LARGE_DRIFT_THRESHOLD = 0.5; // large drift

export function classifyDriftEvent(
  semanticDiff: number,
  clusterJump: boolean
): DriftEventType {
  if (clusterJump) {
    return "cluster_shift";
  }
  if (semanticDiff >= LARGE_DRIFT_THRESHOLD) {
    return "large";
  }
  if (semanticDiff >= DRIFT_THRESHOLD) {
    return "medium";
  }
  return null;
}
