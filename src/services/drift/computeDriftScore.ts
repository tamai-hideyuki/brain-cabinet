/**
 * Drift Score 計算サービス (v3 Spec)
 *
 * Drift = semantic_diff × (1 + cluster_jump_bonus)
 *
 * - semantic_diff: 内容の変化量
 * - cluster_jump: 思考領域の移動（カテゴリー変化）
 */

export type DriftScoreInput = {
  semanticDiff: number; // 0.0〜1.0
  oldClusterId: number | null;
  newClusterId: number | null;
};

export type DriftScoreOutput = {
  driftScore: number;
  clusterJump: boolean;
  clusterJumpBonus: number;
};

/**
 * Drift Score を計算する
 *
 * @example
 * computeDriftScore({ semanticDiff: 0.3, oldClusterId: 2, newClusterId: 5 })
 * // => { driftScore: 0.45, clusterJump: true, clusterJumpBonus: 0.5 }
 */
export function computeDriftScore(input: DriftScoreInput): DriftScoreOutput {
  const { semanticDiff, oldClusterId, newClusterId } = input;

  // クラスター変化（ジャンプ）判定
  const clusterJump =
    oldClusterId !== null &&
    newClusterId !== null &&
    oldClusterId !== newClusterId;

  const clusterJumpBonus = clusterJump ? 0.5 : 0;

  // Drift Score 計算式
  const driftScore = semanticDiff * (1 + clusterJumpBonus);

  return {
    driftScore,
    clusterJump,
    clusterJumpBonus,
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
