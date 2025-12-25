/**
 * Causal Inference Service (v5.11)
 *
 * 影響関係の因果推論を行い、相関から因果へと分析を深化
 *
 * - Granger因果検定: 時系列での因果関係
 * - 介入分析: 特定ノートの影響を分離
 * - 反実仮想分析: 「このノートがなかったら？」
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { round4 } from "../../utils/math";

// ============================================================
// Types
// ============================================================

export type GrangerCausality = {
  sourceNoteId: string;
  targetNoteId: string;
  fStatistic: number;
  pValue: number;
  causalStrength: number; // 0-1 の正規化スコア
  direction: "unidirectional" | "bidirectional" | "none";
  lag: number; // 最適なラグ（日数）
};

export type CausalRelation = {
  noteId: string;
  causes: string[]; // このノートが原因となっているノート
  causedBy: string[]; // このノートの原因となっているノート
  bidirectional: string[]; // 双方向の因果関係
};

export type InterventionEffect = {
  noteId: string;
  clusterDriftAcceleration: number; // クラスター全体への影響加速度
  affectedNotes: number; // 影響を受けたノート数
  avgDriftIncrease: number; // 平均ドリフト増加量
  significance: number; // 統計的有意性 (0-1)
  effectSize: number; // 効果量
  timeToEffect: number; // 効果が現れるまでの日数
};

export type CounterfactualAnalysis = {
  noteId: string;
  title: string;
  missingConcepts: string[]; // このノートがなければ獲得されなかった概念
  alternativePath: string; // 代替的な思考経路の説明
  impactScore: number; // 全体への影響度 (0-1)
  dependentNotes: string[]; // このノートに依存するノート
  pivotProbability: number; // 思考の転換点だった確率
};

export type CausalAnalysis = {
  noteId: string;
  grangerCausality: CausalRelation;
  interventionEffect: InterventionEffect;
  counterfactual: CounterfactualAnalysis;
  insight: string;
};

// ============================================================
// Constants
// ============================================================

export const MIN_OBSERVATIONS = 5; // Granger検定に必要な最小観測数
export const DEFAULT_LAG = 7; // デフォルトのラグ（日数）
export const SIGNIFICANCE_THRESHOLD = 0.05; // p値の閾値
export const MIN_CAUSAL_STRENGTH = 0.3; // 因果関係とみなす最小強度

// ============================================================
// Data Fetching
// ============================================================

type NoteTimeSeries = {
  noteId: string;
  date: string;
  driftScore: number;
  clusterId: number | null;
};

/**
 * ノートの時系列データを取得
 */
export async function getNoteTimeSeries(
  noteId: string,
  days: number = 180
): Promise<NoteTimeSeries[]> {
  const startDate = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const rows = await db.all<{
    note_id: string;
    created_at: number;
    drift_score: string | null;
    new_cluster_id: number | null;
  }>(sql`
    SELECT note_id, created_at, drift_score, new_cluster_id
    FROM note_history
    WHERE note_id = ${noteId}
      AND created_at >= ${startDate}
    ORDER BY created_at ASC
  `);

  return rows.map((r) => ({
    noteId: r.note_id,
    date: new Date(r.created_at * 1000).toISOString().split("T")[0],
    driftScore: r.drift_score ? parseFloat(r.drift_score) : 0,
    clusterId: r.new_cluster_id,
  }));
}

/**
 * クラスター全体の時系列データを取得
 */
export async function getClusterTimeSeries(
  clusterId: number,
  days: number = 180
): Promise<{ date: string; totalDrift: number; noteCount: number }[]> {
  const startDate = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const rows = await db.all<{
    date: string;
    total_drift: number;
    note_count: number;
  }>(sql`
    SELECT
      DATE(created_at, 'unixepoch') as date,
      SUM(CAST(drift_score AS REAL)) as total_drift,
      COUNT(*) as note_count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at >= ${startDate}
      AND nh.drift_score IS NOT NULL
    GROUP BY date
    ORDER BY date ASC
  `);

  return rows.map((r) => ({
    date: r.date,
    totalDrift: r.total_drift || 0,
    noteCount: r.note_count,
  }));
}

/**
 * 影響エッジの時系列データを取得
 */
export async function getInfluenceTimeSeries(
  sourceNoteId: string,
  targetNoteId: string,
  days: number = 180
): Promise<{ date: string; weight: number }[]> {
  const startDate = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  // note_historyからソースとターゲットの変化を時系列で取得
  const rows = await db.all<{
    date: string;
    drift_score: number;
  }>(sql`
    SELECT
      DATE(created_at, 'unixepoch') as date,
      CAST(drift_score AS REAL) as drift_score
    FROM note_history
    WHERE note_id = ${targetNoteId}
      AND created_at >= ${startDate}
      AND drift_score IS NOT NULL
    ORDER BY date ASC
  `);

  return rows.map((r) => ({
    date: r.date,
    weight: r.drift_score || 0,
  }));
}

// ============================================================
// Granger Causality Test
// ============================================================

/**
 * 簡易Granger因果検定
 *
 * H0: X は Y を Granger-cause しない
 * F統計量を計算し、因果関係の強度を推定
 */
export function grangerCausalityTest(
  sourceSeries: number[],
  targetSeries: number[],
  lag: number = DEFAULT_LAG
): { fStatistic: number; pValue: number; causalStrength: number } {
  if (sourceSeries.length < MIN_OBSERVATIONS || targetSeries.length < MIN_OBSERVATIONS) {
    return { fStatistic: 0, pValue: 1, causalStrength: 0 };
  }

  // 最小長に揃える
  const minLength = Math.min(sourceSeries.length, targetSeries.length);
  const source = sourceSeries.slice(-minLength);
  const target = targetSeries.slice(-minLength);

  if (minLength <= lag + 1) {
    return { fStatistic: 0, pValue: 1, causalStrength: 0 };
  }

  // 制約モデル (ターゲットの過去のみ) の残差二乗和
  const rssRestricted = calculateRSS(target, lag, [target]);

  // 非制約モデル (ターゲット + ソースの過去) の残差二乗和
  const rssUnrestricted = calculateRSS(target, lag, [target, source]);

  if (rssUnrestricted === 0 || rssRestricted === 0) {
    return { fStatistic: 0, pValue: 1, causalStrength: 0 };
  }

  // F統計量
  const n = minLength - lag;
  const k = lag; // 追加されたパラメータ数
  const fStatistic = ((rssRestricted - rssUnrestricted) / k) / (rssUnrestricted / (n - 2 * lag - 1));

  // p値の近似（F分布の簡易近似）
  const pValue = approximateFPValue(fStatistic, k, n - 2 * lag - 1);

  // 因果強度（0-1に正規化）
  const causalStrength = Math.min(1, Math.max(0, 1 - pValue));

  return {
    fStatistic: round4(Math.max(0, fStatistic)),
    pValue: round4(pValue),
    causalStrength: round4(causalStrength),
  };
}

/**
 * 残差二乗和を計算（自己回帰モデル）
 */
function calculateRSS(
  target: number[],
  lag: number,
  predictors: number[][]
): number {
  let rss = 0;
  const n = target.length;

  for (let t = lag; t < n; t++) {
    let predicted = 0;

    // 各予測変数のラグ項を使用
    for (const predictor of predictors) {
      for (let l = 1; l <= lag; l++) {
        if (t - l >= 0) {
          // 簡易的な線形回帰係数（平均を使用）
          predicted += predictor[t - l] * (1 / (lag * predictors.length));
        }
      }
    }

    const residual = target[t] - predicted;
    rss += residual * residual;
  }

  return rss;
}

/**
 * F分布のp値を近似
 */
function approximateFPValue(f: number, df1: number, df2: number): number {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;

  // 簡易近似（正確な計算にはベータ関数が必要）
  const x = df2 / (df2 + df1 * f);
  // 不完全ベータ関数の近似
  const pValue = Math.pow(x, df2 / 2) * Math.pow(1 - x, df1 / 2);

  return Math.min(1, Math.max(0, pValue));
}

/**
 * 2つのノート間のGranger因果関係を検定
 */
export async function testGrangerCausality(
  sourceNoteId: string,
  targetNoteId: string,
  lag: number = DEFAULT_LAG
): Promise<GrangerCausality> {
  const sourceSeries = await getNoteTimeSeries(sourceNoteId);
  const targetSeries = await getNoteTimeSeries(targetNoteId);

  const sourceValues = sourceSeries.map((s) => s.driftScore);
  const targetValues = targetSeries.map((s) => s.driftScore);

  // 順方向の検定（source → target）
  const forward = grangerCausalityTest(sourceValues, targetValues, lag);

  // 逆方向の検定（target → source）
  const backward = grangerCausalityTest(targetValues, sourceValues, lag);

  let direction: "unidirectional" | "bidirectional" | "none";
  if (forward.causalStrength >= MIN_CAUSAL_STRENGTH && backward.causalStrength >= MIN_CAUSAL_STRENGTH) {
    direction = "bidirectional";
  } else if (forward.causalStrength >= MIN_CAUSAL_STRENGTH) {
    direction = "unidirectional";
  } else {
    direction = "none";
  }

  return {
    sourceNoteId,
    targetNoteId,
    fStatistic: forward.fStatistic,
    pValue: forward.pValue,
    causalStrength: forward.causalStrength,
    direction,
    lag,
  };
}

/**
 * ノートの因果関係を分析
 */
export async function analyzeCausalRelations(
  noteId: string,
  limit: number = 10
): Promise<CausalRelation> {
  // 影響エッジを取得
  const influencers = await db.all<{
    source_note_id: string;
    weight: number;
  }>(sql`
    SELECT source_note_id, weight
    FROM note_influence_edges
    WHERE target_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);

  const influenced = await db.all<{
    target_note_id: string;
    weight: number;
  }>(sql`
    SELECT target_note_id, weight
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT ${limit}
  `);

  const causes: string[] = [];
  const causedBy: string[] = [];
  const bidirectional: string[] = [];

  // 各影響元との因果関係を検定
  for (const inf of influencers) {
    const causality = await testGrangerCausality(inf.source_note_id, noteId);
    if (causality.direction === "unidirectional") {
      causedBy.push(inf.source_note_id);
    } else if (causality.direction === "bidirectional") {
      bidirectional.push(inf.source_note_id);
    }
  }

  // 各影響先との因果関係を検定
  for (const inf of influenced) {
    const causality = await testGrangerCausality(noteId, inf.target_note_id);
    if (causality.direction === "unidirectional") {
      causes.push(inf.target_note_id);
    } else if (causality.direction === "bidirectional" && !bidirectional.includes(inf.target_note_id)) {
      bidirectional.push(inf.target_note_id);
    }
  }

  return {
    noteId,
    causes,
    causedBy,
    bidirectional,
  };
}

// ============================================================
// Intervention Analysis
// ============================================================

/**
 * ノート作成/更新が与えた介入効果を分析
 */
export async function analyzeInterventionEffect(
  noteId: string
): Promise<InterventionEffect> {
  // ノートの情報を取得
  const noteInfo = await db.get<{
    cluster_id: number | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT cluster_id, created_at, updated_at
    FROM notes
    WHERE id = ${noteId}
  `);

  if (!noteInfo || !noteInfo.cluster_id) {
    return {
      noteId,
      clusterDriftAcceleration: 0,
      affectedNotes: 0,
      avgDriftIncrease: 0,
      significance: 0,
      effectSize: 0,
      timeToEffect: 0,
    };
  }

  const interventionTime = noteInfo.updated_at || noteInfo.created_at;
  const clusterId = noteInfo.cluster_id;

  // 介入前後のクラスターのドリフトを比較
  const beforeWindow = 14 * 24 * 60 * 60; // 14日
  const afterWindow = 14 * 24 * 60 * 60;

  // 介入前のドリフト
  const beforeDrift = await db.get<{
    avg_drift: number;
    count: number;
  }>(sql`
    SELECT
      AVG(CAST(drift_score AS REAL)) as avg_drift,
      COUNT(*) as count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at >= ${interventionTime - beforeWindow}
      AND nh.created_at < ${interventionTime}
      AND nh.drift_score IS NOT NULL
  `);

  // 介入後のドリフト
  const afterDrift = await db.get<{
    avg_drift: number;
    count: number;
  }>(sql`
    SELECT
      AVG(CAST(drift_score AS REAL)) as avg_drift,
      COUNT(*) as count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at >= ${interventionTime}
      AND nh.created_at < ${interventionTime + afterWindow}
      AND nh.drift_score IS NOT NULL
  `);

  const avgBefore = beforeDrift?.avg_drift || 0;
  const avgAfter = afterDrift?.avg_drift || 0;
  const countBefore = beforeDrift?.count || 0;
  const countAfter = afterDrift?.count || 0;

  // 効果の計算
  const driftIncrease = avgAfter - avgBefore;
  const acceleration = avgBefore > 0 ? driftIncrease / avgBefore : driftIncrease;

  // 影響を受けたノート数
  const affectedNotes = await db.get<{ count: number }>(sql`
    SELECT COUNT(DISTINCT target_note_id) as count
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
  `);

  // 効果量（Cohen's d の簡易版）
  const pooledStd = Math.sqrt((countBefore * avgBefore * avgBefore + countAfter * avgAfter * avgAfter) / (countBefore + countAfter));
  const effectSize = pooledStd > 0 ? Math.abs(driftIncrease) / pooledStd : 0;

  // 統計的有意性（t検定の簡易近似）
  const tStat = countBefore + countAfter > 2
    ? driftIncrease / (pooledStd / Math.sqrt(countBefore + countAfter))
    : 0;
  const significance = Math.min(1, Math.max(0, 1 - Math.exp(-Math.abs(tStat) / 2)));

  // 効果が現れるまでの時間（最初の有意な変化）
  const firstChange = await db.get<{ first_change: number }>(sql`
    SELECT MIN(created_at) as first_change
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
      AND nh.created_at > ${interventionTime}
      AND nh.drift_score IS NOT NULL
      AND CAST(nh.drift_score AS REAL) > ${avgBefore * 1.5}
  `);

  const timeToEffect = firstChange?.first_change
    ? Math.floor((firstChange.first_change - interventionTime) / (24 * 60 * 60))
    : 0;

  return {
    noteId,
    clusterDriftAcceleration: round4(acceleration),
    affectedNotes: affectedNotes?.count || 0,
    avgDriftIncrease: round4(driftIncrease),
    significance: round4(significance),
    effectSize: round4(Math.min(3, effectSize)), // Cohen's d は通常3以下
    timeToEffect,
  };
}

// ============================================================
// Counterfactual Analysis
// ============================================================

/**
 * 反実仮想分析：このノートがなかったら何が起きていたか
 */
export async function analyzeCounterfactual(
  noteId: string
): Promise<CounterfactualAnalysis> {
  // ノート情報を取得
  const noteInfo = await db.get<{
    title: string;
    cluster_id: number | null;
    tags: string | null;
    created_at: number;
  }>(sql`
    SELECT title, cluster_id, tags, created_at
    FROM notes
    WHERE id = ${noteId}
  `);

  if (!noteInfo) {
    return {
      noteId,
      title: "Unknown",
      missingConcepts: [],
      alternativePath: "ノートが見つかりません。",
      impactScore: 0,
      dependentNotes: [],
      pivotProbability: 0,
    };
  }

  // このノートに依存するノート（影響を受けているノート）
  const dependentNotes = await db.all<{ target_note_id: string }>(sql`
    SELECT DISTINCT target_note_id
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
    ORDER BY weight DESC
    LIMIT 10
  `);

  const dependentIds = dependentNotes.map((n) => n.target_note_id);

  // クラスター内での位置づけを確認
  const clusterNotes = noteInfo.cluster_id ? await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM notes
    WHERE cluster_id = ${noteInfo.cluster_id}
  `) : null;

  // このノートがクラスターの初期メンバーかどうか
  const earlierNotesInCluster = noteInfo.cluster_id ? await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM notes
    WHERE cluster_id = ${noteInfo.cluster_id}
      AND created_at < ${noteInfo.created_at}
  `) : null;

  const isFoundingMember = (earlierNotesInCluster?.count || 0) < 3;

  // タグから概念を抽出
  const tags = noteInfo.tags ? JSON.parse(noteInfo.tags) : [];
  const missingConcepts = tags.slice(0, 5);

  // 影響スコアを計算
  const totalInfluence = await db.get<{ total: number }>(sql`
    SELECT SUM(weight) as total
    FROM note_influence_edges
    WHERE source_note_id = ${noteId}
  `);

  const maxInfluence = await db.get<{ max: number }>(sql`
    SELECT MAX(total) as max
    FROM (
      SELECT SUM(weight) as total
      FROM note_influence_edges
      GROUP BY source_note_id
    )
  `);

  const impactScore = maxInfluence?.max && maxInfluence.max > 0
    ? (totalInfluence?.total || 0) / maxInfluence.max
    : 0;

  // ピボット確率（クラスター変更を誘発したか）
  const clusterChanges = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM note_history
    WHERE note_id IN (
      SELECT target_note_id FROM note_influence_edges WHERE source_note_id = ${noteId}
    )
    AND prev_cluster_id IS NOT NULL
    AND new_cluster_id IS NOT NULL
    AND prev_cluster_id != new_cluster_id
  `);

  const pivotProbability = dependentIds.length > 0
    ? (clusterChanges?.count || 0) / dependentIds.length
    : 0;

  // 代替経路の説明を生成
  const alternativePath = generateAlternativePath(
    isFoundingMember,
    impactScore,
    dependentIds.length,
    noteInfo.cluster_id
  );

  return {
    noteId,
    title: noteInfo.title,
    missingConcepts,
    alternativePath,
    impactScore: round4(impactScore),
    dependentNotes: dependentIds,
    pivotProbability: round4(pivotProbability),
  };
}

/**
 * 代替経路の説明を生成
 */
function generateAlternativePath(
  isFoundingMember: boolean,
  impactScore: number,
  dependentCount: number,
  clusterId: number | null
): string {
  if (isFoundingMember && clusterId) {
    return `このノートはクラスター${clusterId}の基盤となっています。これがなければ、このクラスター全体が形成されなかった可能性があります。`;
  }

  if (impactScore > 0.7) {
    return `非常に高い影響力を持つノートです。これがなければ、${dependentCount}個のノートの発展が大きく異なっていたでしょう。`;
  }

  if (impactScore > 0.4) {
    return `中程度の影響力があります。他のノートが部分的に同じ役割を果たしていた可能性がありますが、思考の深さは減っていたでしょう。`;
  }

  if (impactScore > 0.1) {
    return `この思考経路は他のノートでも補完可能でした。ただし、到達までにより時間がかかっていたかもしれません。`;
  }

  return `影響は限定的でした。他の経路から同様の結論に到達できた可能性が高いです。`;
}

// ============================================================
// Combined Analysis
// ============================================================

/**
 * ノートの総合因果分析
 */
export async function analyzeCausality(
  noteId: string
): Promise<CausalAnalysis> {
  const [causalRelation, interventionEffect, counterfactual] = await Promise.all([
    analyzeCausalRelations(noteId),
    analyzeInterventionEffect(noteId),
    analyzeCounterfactual(noteId),
  ]);

  const insight = generateCausalInsight(causalRelation, interventionEffect, counterfactual);

  return {
    noteId,
    grangerCausality: causalRelation,
    interventionEffect,
    counterfactual,
    insight,
  };
}

/**
 * 因果分析のインサイトを生成
 */
function generateCausalInsight(
  causal: CausalRelation,
  intervention: InterventionEffect,
  counterfactual: CounterfactualAnalysis
): string {
  const parts: string[] = [];

  // 因果関係の説明
  if (causal.causes.length > 0 && causal.causedBy.length > 0) {
    parts.push(`このノートは${causal.causedBy.length}個のノートから影響を受け、${causal.causes.length}個のノートに影響を与えています。`);
  } else if (causal.causes.length > 0) {
    parts.push(`このノートは${causal.causes.length}個のノートの発展に因果的に貢献しています。`);
  } else if (causal.causedBy.length > 0) {
    parts.push(`このノートは${causal.causedBy.length}個のノートから因果的な影響を受けています。`);
  }

  if (causal.bidirectional.length > 0) {
    parts.push(`${causal.bidirectional.length}個のノートとは相互に影響し合っています。`);
  }

  // 介入効果の説明
  if (intervention.significance > 0.7) {
    if (intervention.clusterDriftAcceleration > 0.5) {
      parts.push(`このノートはクラスター全体の思考を${Math.round(intervention.clusterDriftAcceleration * 100)}%加速させました。`);
    } else if (intervention.clusterDriftAcceleration < -0.3) {
      parts.push(`このノートによりクラスターの思考が収束・安定化しました。`);
    }
  }

  // 反実仮想の説明
  if (counterfactual.impactScore > 0.5) {
    parts.push(`思考の発展において重要な役割を果たしています。`);
    if (counterfactual.pivotProbability > 0.3) {
      parts.push(`特に思考の方向転換を促した可能性が高いです。`);
    }
  }

  if (parts.length === 0) {
    return "因果関係の分析には十分なデータがありません。";
  }

  return parts.join(" ");
}

// ============================================================
// Batch Analysis
// ============================================================

/**
 * 全ノートの因果分析サマリー
 */
export async function getGlobalCausalSummary(): Promise<{
  totalCausalPairs: number;
  strongCausalRelations: number;
  avgCausalStrength: number;
  topCausalInfluencers: Array<{ noteId: string; causedCount: number; avgStrength: number }>;
  pivotNotes: Array<{ noteId: string; title: string; pivotProbability: number }>;
}> {
  // 影響エッジの統計
  const edgeStats = await db.get<{
    total: number;
    avg_weight: number;
  }>(sql`
    SELECT COUNT(*) as total, AVG(weight) as avg_weight
    FROM note_influence_edges
  `);

  // 強い影響関係（weight > 0.5）
  const strongRelations = await db.get<{ count: number }>(sql`
    SELECT COUNT(*) as count
    FROM note_influence_edges
    WHERE weight > 0.5
  `);

  // Top influencers
  const topInfluencers = await db.all<{
    source_note_id: string;
    caused_count: number;
    avg_strength: number;
  }>(sql`
    SELECT
      source_note_id,
      COUNT(*) as caused_count,
      AVG(weight) as avg_strength
    FROM note_influence_edges
    WHERE weight > 0.3
    GROUP BY source_note_id
    ORDER BY caused_count DESC
    LIMIT 10
  `);

  // ピボットノート（クラスター変更を多く誘発したノート）
  const pivotNotes = await db.all<{
    note_id: string;
    title: string;
    pivot_count: number;
  }>(sql`
    SELECT
      n.id as note_id,
      n.title,
      COUNT(DISTINCT nh.note_id) as pivot_count
    FROM notes n
    JOIN note_influence_edges nie ON n.id = nie.source_note_id
    JOIN note_history nh ON nie.target_note_id = nh.note_id
    WHERE nh.prev_cluster_id IS NOT NULL
      AND nh.new_cluster_id IS NOT NULL
      AND nh.prev_cluster_id != nh.new_cluster_id
    GROUP BY n.id
    ORDER BY pivot_count DESC
    LIMIT 5
  `);

  return {
    totalCausalPairs: edgeStats?.total || 0,
    strongCausalRelations: strongRelations?.count || 0,
    avgCausalStrength: round4(edgeStats?.avg_weight || 0),
    topCausalInfluencers: topInfluencers.map((t) => ({
      noteId: t.source_note_id,
      causedCount: t.caused_count,
      avgStrength: round4(t.avg_strength),
    })),
    pivotNotes: pivotNotes.map((p) => ({
      noteId: p.note_id,
      title: p.title,
      pivotProbability: round4(p.pivot_count / 10), // 正規化
    })),
  };
}
