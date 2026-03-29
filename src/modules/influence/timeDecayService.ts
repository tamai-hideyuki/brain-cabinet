/**
 * Time Decay Service (v5.7)
 *
 * 影響エッジの時間減衰を計算する
 *
 * 式: decayedWeight = weight × exp(-λ × daysSinceCreation)
 *
 * λ（減衰率）の設定:
 * - 0.01: 半減期 ≈ 70日（緩やか、長期的傾向重視）
 * - 0.02: 半減期 ≈ 35日（バランス型、推奨）
 * - 0.05: 半減期 ≈ 14日（急速、直近重視）
 */

// デフォルトの減衰率（λ = 0.02、半減期 ≈ 35日）
export const DEFAULT_DECAY_RATE = 0.02;

// 減衰プリセット
export const DECAY_PRESETS = {
  slow: 0.01,      // 半減期 ≈ 70日
  balanced: 0.02,  // 半減期 ≈ 35日（デフォルト）
  fast: 0.05,      // 半減期 ≈ 14日
} as const;

export type DecayPreset = keyof typeof DECAY_PRESETS;

/**
 * 経過日数を計算
 *
 * @param createdAt - 作成日時（Unix秒）
 * @param now - 現在日時（Unix秒）省略時は現在時刻
 * @returns 経過日数（小数点以下含む）
 */
export function calculateDaysSinceCreation(
  createdAt: number,
  now?: number
): number {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  const secondsPerDay = 86400; // 24 * 60 * 60
  return Math.max(0, (currentTime - createdAt) / secondsPerDay);
}

/**
 * 時間減衰を適用した重みを計算
 *
 * @param weight - 元の重み
 * @param daysSinceCreation - 作成からの経過日数
 * @param lambda - 減衰率（デフォルト: 0.02）
 * @returns 減衰後の重み
 *
 * @example
 * // 2週間経過、λ = 0.02 の場合
 * applyTimeDecay(0.8, 14, 0.02);
 * // => 0.8 × exp(-0.02 × 14) ≈ 0.60
 */
export function applyTimeDecay(
  weight: number,
  daysSinceCreation: number,
  lambda: number = DEFAULT_DECAY_RATE
): number {
  if (daysSinceCreation <= 0) return weight;
  if (lambda <= 0) return weight;

  const decayFactor = Math.exp(-lambda * daysSinceCreation);
  return weight * decayFactor;
}

/**
 * 減衰率から半減期（日数）を計算
 *
 * 半減期 = ln(2) / λ
 *
 * @param lambda - 減衰率
 * @returns 半減期（日数）
 */
export function calculateHalfLife(lambda: number): number {
  if (lambda <= 0) return Infinity;
  return Math.LN2 / lambda;
}

/**
 * 半減期から減衰率（λ）を計算
 *
 * λ = ln(2) / 半減期
 *
 * @param halfLifeDays - 半減期（日数）
 * @returns 減衰率
 */
export function calculateLambdaFromHalfLife(halfLifeDays: number): number {
  if (halfLifeDays <= 0) return Infinity;
  return Math.LN2 / halfLifeDays;
}

/**
 * 影響エッジに時間減衰を適用
 */
export type InfluenceEdgeWithDecay = {
  sourceNoteId: string;
  targetNoteId: string;
  weight: number;           // 元の重み
  decayedWeight: number;    // 減衰後の重み
  cosineSim: number;
  driftScore: number;
  createdAt: number;        // 作成日時（Unix秒）
  daysSinceCreation: number;
  decayFactor: number;      // 減衰係数 (0.0〜1.0)
};

/**
 * 複数のエッジに時間減衰を適用
 *
 * @param edges - 影響エッジの配列
 * @param lambda - 減衰率
 * @param now - 現在日時（Unix秒）省略時は現在時刻
 * @returns 減衰情報を付加したエッジ配列
 */
export function applyTimeDecayToEdges<
  T extends {
    weight: number;
    createdAt: number;
  }
>(
  edges: T[],
  lambda: number = DEFAULT_DECAY_RATE,
  now?: number
): (T & {
  decayedWeight: number;
  daysSinceCreation: number;
  decayFactor: number;
})[] {
  const currentTime = now ?? Math.floor(Date.now() / 1000);

  return edges.map((edge) => {
    const daysSinceCreation = calculateDaysSinceCreation(edge.createdAt, currentTime);
    const decayFactor = Math.exp(-lambda * Math.max(0, daysSinceCreation));
    const decayedWeight = edge.weight * decayFactor;

    return {
      ...edge,
      decayedWeight: Math.round(decayedWeight * 10000) / 10000,
      daysSinceCreation: Math.round(daysSinceCreation * 100) / 100,
      decayFactor: Math.round(decayFactor * 10000) / 10000,
    };
  });
}

/**
 * 減衰後の重みでフィルタリング
 *
 * @param edges - 減衰情報付きエッジ配列
 * @param threshold - 閾値（これ以下のエッジは除外）
 * @returns フィルタリング後のエッジ配列
 */
export function filterByDecayedWeight<
  T extends { decayedWeight: number }
>(edges: T[], threshold: number = 0.05): T[] {
  return edges.filter((edge) => edge.decayedWeight >= threshold);
}

/**
 * 減衰後の重みでソート（降順）
 */
export function sortByDecayedWeight<
  T extends { decayedWeight: number }
>(edges: T[]): T[] {
  return [...edges].sort((a, b) => b.decayedWeight - a.decayedWeight);
}

/**
 * 時間減衰統計を計算
 */
export type TimeDecayStats = {
  totalEdges: number;
  avgOriginalWeight: number;
  avgDecayedWeight: number;
  avgDecayFactor: number;
  avgAge: number;             // 平均経過日数
  oldestEdgeAge: number;      // 最も古いエッジの経過日数
  newestEdgeAge: number;      // 最も新しいエッジの経過日数
  effectiveEdges: number;     // 閾値以上の有効エッジ数
  decayImpact: number;        // 減衰の影響度 (1 - avgDecayFactor)
};

export function calculateTimeDecayStats<
  T extends {
    weight: number;
    decayedWeight: number;
    decayFactor: number;
    daysSinceCreation: number;
  }
>(edges: T[], threshold: number = 0.05): TimeDecayStats {
  if (edges.length === 0) {
    return {
      totalEdges: 0,
      avgOriginalWeight: 0,
      avgDecayedWeight: 0,
      avgDecayFactor: 1,
      avgAge: 0,
      oldestEdgeAge: 0,
      newestEdgeAge: 0,
      effectiveEdges: 0,
      decayImpact: 0,
    };
  }

  const totalOriginalWeight = edges.reduce((sum, e) => sum + e.weight, 0);
  const totalDecayedWeight = edges.reduce((sum, e) => sum + e.decayedWeight, 0);
  const totalDecayFactor = edges.reduce((sum, e) => sum + e.decayFactor, 0);
  const totalAge = edges.reduce((sum, e) => sum + e.daysSinceCreation, 0);

  const ages = edges.map((e) => e.daysSinceCreation);
  const effectiveEdges = edges.filter((e) => e.decayedWeight >= threshold).length;

  const avgDecayFactor = totalDecayFactor / edges.length;

  return {
    totalEdges: edges.length,
    avgOriginalWeight: Math.round((totalOriginalWeight / edges.length) * 10000) / 10000,
    avgDecayedWeight: Math.round((totalDecayedWeight / edges.length) * 10000) / 10000,
    avgDecayFactor: Math.round(avgDecayFactor * 10000) / 10000,
    avgAge: Math.round((totalAge / edges.length) * 100) / 100,
    oldestEdgeAge: Math.round(Math.max(...ages) * 100) / 100,
    newestEdgeAge: Math.round(Math.min(...ages) * 100) / 100,
    effectiveEdges,
    decayImpact: Math.round((1 - avgDecayFactor) * 10000) / 10000,
  };
}
