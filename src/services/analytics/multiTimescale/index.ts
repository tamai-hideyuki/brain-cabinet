/**
 * Multi-Timescale Analysis Service (v5.9)
 *
 * 複数の時間スケールでクラスター/ノート活動を分析
 *
 * - 週次/月次/四半期トレンドの並列追跡
 * - 季節パターン検出（年間サイクル）
 * - フェーズ遷移検出（持続的なモード変化）
 */

import { db } from "../../../db/client";
import { sql } from "drizzle-orm";
import { round4 } from "../../../utils/math";

// ============================================================
// Types
// ============================================================

export type TimeScale = "weekly" | "monthly" | "quarterly";

export type TrendDirection = "rising" | "falling" | "stable";

export type Trend = {
  direction: TrendDirection;
  velocity: number;       // 変化速度 (-1.0 ~ +1.0)
  confidence: number;     // 信頼度 (0.0 ~ 1.0)
  dataPoints: number;     // データ点数
};

export type MultiScaleTrends = {
  weekly: Trend;
  monthly: Trend;
  quarterly: Trend;
};

export type SeasonalPattern = {
  detected: boolean;
  peakMonths: number[];        // 1-12
  troughMonths: number[];      // 1-12
  amplitude: number;           // 振幅（変動の大きさ）
  confidence: number;
};

export type Phase =
  | "dormant"        // 休眠期: 活動なし
  | "emerging"       // 萌芽期: 新しく活動開始
  | "expansion"      // 拡大期: 活発な成長
  | "consolidation"  // 統合期: 安定化・深化
  | "declining";     // 衰退期: 活動減少

export type PhaseTransition = {
  currentPhase: Phase;
  previousPhase: Phase | null;
  transitionDate: string | null;    // YYYY-MM-DD
  stability: number;                // 0.0 ~ 1.0
  daysInCurrentPhase: number;
};

export type ClusterTimescaleAnalysis = {
  clusterId: number;
  trends: MultiScaleTrends;
  seasonalPattern: SeasonalPattern;
  phaseTransition: PhaseTransition;
  insight: string;
};

export type GlobalTimescaleAnalysis = {
  analysisDate: string;
  clusterCount: number;
  activeClusterCount: number;
  globalTrends: MultiScaleTrends;
  topGrowingClusters: Array<{ clusterId: number; velocity: number }>;
  topDecliningClusters: Array<{ clusterId: number; velocity: number }>;
  seasonalPatterns: Array<{ clusterId: number; pattern: SeasonalPattern }>;
  phaseTransitions: Array<{ clusterId: number; transition: PhaseTransition }>;
};

// ============================================================
// Constants
// ============================================================

export const TIME_WINDOWS = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
} as const;

export const TREND_THRESHOLDS = {
  rising: 0.1,     // 10%以上の増加
  falling: -0.1,   // 10%以上の減少
} as const;

export const PHASE_THRESHOLDS = {
  dormant: 0,
  emerging: 2,
  expansion: 5,
  consolidation: 3,
} as const;

// ============================================================
// Data Fetching
// ============================================================

type DailyActivity = {
  date: string;
  clusterId: number;
  noteCount: number;
  changeCount: number;
};

/**
 * クラスター別の日次活動データを取得
 */
export async function getClusterDailyActivity(
  days: number = 365
): Promise<DailyActivity[]> {
  const startDate = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  // ノート作成
  const noteCreations = await db.all<{
    date: string;
    cluster_id: number;
    count: number;
  }>(sql`
    SELECT
      date(created_at, 'unixepoch') as date,
      cluster_id,
      count(*) as count
    FROM notes
    WHERE created_at >= ${startDate}
      AND cluster_id IS NOT NULL
    GROUP BY date, cluster_id
  `);

  // ノート更新（履歴）
  const noteUpdates = await db.all<{
    date: string;
    cluster_id: number;
    count: number;
  }>(sql`
    SELECT
      date(nh.created_at, 'unixepoch') as date,
      n.cluster_id,
      count(*) as count
    FROM note_history nh
    JOIN notes n ON nh.note_id = n.id
    WHERE nh.created_at >= ${startDate}
      AND n.cluster_id IS NOT NULL
    GROUP BY date, n.cluster_id
  `);

  // マージ
  const activityMap = new Map<string, DailyActivity>();

  for (const row of noteCreations) {
    const key = `${row.date}-${row.cluster_id}`;
    activityMap.set(key, {
      date: row.date,
      clusterId: row.cluster_id,
      noteCount: row.count,
      changeCount: 0,
    });
  }

  for (const row of noteUpdates) {
    const key = `${row.date}-${row.cluster_id}`;
    const existing = activityMap.get(key);
    if (existing) {
      existing.changeCount = row.count;
    } else {
      activityMap.set(key, {
        date: row.date,
        clusterId: row.cluster_id,
        noteCount: 0,
        changeCount: row.count,
      });
    }
  }

  return Array.from(activityMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * 特定クラスターの日次活動を取得
 */
export function filterByCluster(
  activities: DailyActivity[],
  clusterId: number
): DailyActivity[] {
  return activities.filter(a => a.clusterId === clusterId);
}

// ============================================================
// Trend Calculation
// ============================================================

/**
 * 日付文字列を Date オブジェクトに変換
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

/**
 * 期間内の活動量を集計
 */
export function aggregateActivity(
  activities: DailyActivity[],
  endDate: Date,
  windowDays: number
): number {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - windowDays);

  return activities
    .filter(a => {
      const d = parseDate(a.date);
      return d >= startDate && d <= endDate;
    })
    .reduce((sum, a) => sum + a.noteCount + a.changeCount, 0);
}

/**
 * 線形回帰で傾きを計算
 */
export function calculateSlope(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * 決定係数 R² を計算
 */
export function calculateR2(values: number[], slope: number): number {
  if (values.length < 2) return 0;

  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const intercept = mean - slope * (n - 1) / 2;

  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += Math.pow(values[i] - predicted, 2);
    ssTot += Math.pow(values[i] - mean, 2);
  }

  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}

/**
 * 単一タイムスケールのトレンドを計算
 */
export function calculateTrend(
  activities: DailyActivity[],
  windowDays: number,
  sampleCount: number = 4
): Trend {
  if (activities.length === 0) {
    return {
      direction: "stable",
      velocity: 0,
      confidence: 0,
      dataPoints: 0,
    };
  }

  const now = new Date();
  const values: number[] = [];

  // 複数のサンプルポイントで活動量を計算
  for (let i = sampleCount - 1; i >= 0; i--) {
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() - i * windowDays);
    const activity = aggregateActivity(activities, endDate, windowDays);
    values.push(activity);
  }

  const slope = calculateSlope(values);
  const r2 = calculateR2(values, slope);

  // 正規化された速度を計算
  const maxVal = Math.max(...values, 1);
  const normalizedSlope = slope / maxVal;
  const velocity = Math.max(-1, Math.min(1, normalizedSlope * sampleCount));

  // トレンド方向を判定
  let direction: TrendDirection = "stable";
  if (velocity > TREND_THRESHOLDS.rising) {
    direction = "rising";
  } else if (velocity < TREND_THRESHOLDS.falling) {
    direction = "falling";
  }

  return {
    direction,
    velocity: round4(velocity),
    confidence: round4(r2),
    dataPoints: values.reduce((a, b) => a + b, 0),
  };
}

/**
 * マルチタイムスケールのトレンドを計算
 */
export function calculateMultiScaleTrends(
  activities: DailyActivity[]
): MultiScaleTrends {
  return {
    weekly: calculateTrend(activities, TIME_WINDOWS.weekly, 4),
    monthly: calculateTrend(activities, TIME_WINDOWS.monthly, 3),
    quarterly: calculateTrend(activities, TIME_WINDOWS.quarterly, 4),
  };
}

// ============================================================
// Seasonal Pattern Detection
// ============================================================

/**
 * 月別の活動量を集計
 */
export function aggregateByMonth(
  activities: DailyActivity[]
): Map<number, number[]> {
  const monthlyData = new Map<number, number[]>();

  for (let m = 1; m <= 12; m++) {
    monthlyData.set(m, []);
  }

  for (const a of activities) {
    const date = parseDate(a.date);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const activity = a.noteCount + a.changeCount;

    // 年をキーに追加（複数年のデータを蓄積）
    const existing = monthlyData.get(month) ?? [];
    existing.push(activity);
    monthlyData.set(month, existing);
  }

  return monthlyData;
}

/**
 * 季節パターンを検出
 */
export function detectSeasonalPattern(
  activities: DailyActivity[]
): SeasonalPattern {
  if (activities.length < 60) {
    // 最低2ヶ月分のデータが必要
    return {
      detected: false,
      peakMonths: [],
      troughMonths: [],
      amplitude: 0,
      confidence: 0,
    };
  }

  const monthlyData = aggregateByMonth(activities);
  const monthlyAvg = new Map<number, number>();

  // 各月の平均を計算
  for (const [month, values] of monthlyData) {
    if (values.length > 0) {
      monthlyAvg.set(month, values.reduce((a, b) => a + b, 0) / values.length);
    } else {
      monthlyAvg.set(month, 0);
    }
  }

  // 全体の平均
  const allAvg = Array.from(monthlyAvg.values()).reduce((a, b) => a + b, 0) / 12;
  if (allAvg === 0) {
    return {
      detected: false,
      peakMonths: [],
      troughMonths: [],
      amplitude: 0,
      confidence: 0,
    };
  }

  // ピークと谷を検出
  const threshold = allAvg * 0.3; // 30%以上の偏差
  const peakMonths: number[] = [];
  const troughMonths: number[] = [];

  for (const [month, avg] of monthlyAvg) {
    if (avg > allAvg + threshold) {
      peakMonths.push(month);
    } else if (avg < allAvg - threshold) {
      troughMonths.push(month);
    }
  }

  // 振幅を計算
  const maxAvg = Math.max(...monthlyAvg.values());
  const minAvg = Math.min(...monthlyAvg.values());
  const amplitude = (maxAvg - minAvg) / allAvg;

  // 信頼度（データ量に基づく）
  const totalDataPoints = activities.length;
  const confidence = Math.min(1, totalDataPoints / 365);

  const detected = peakMonths.length > 0 || troughMonths.length > 0;

  return {
    detected,
    peakMonths: peakMonths.sort((a, b) => a - b),
    troughMonths: troughMonths.sort((a, b) => a - b),
    amplitude: round4(amplitude),
    confidence: round4(confidence),
  };
}

// ============================================================
// Phase Transition Detection
// ============================================================

/**
 * 週単位の活動量を計算
 */
export function getWeeklyActivity(
  activities: DailyActivity[]
): Array<{ weekStart: string; activity: number }> {
  const weekMap = new Map<string, number>();

  for (const a of activities) {
    const date = parseDate(a.date);
    // 週の開始日（月曜日）を計算
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    const weekStart = date.toISOString().split("T")[0];

    const existing = weekMap.get(weekStart) ?? 0;
    weekMap.set(weekStart, existing + a.noteCount + a.changeCount);
  }

  return Array.from(weekMap.entries())
    .map(([weekStart, activity]) => ({ weekStart, activity }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * 現在のフェーズを判定
 */
export function determinePhase(
  recentActivity: number,
  previousActivity: number,
  overallAvg: number
): Phase {
  if (recentActivity === 0) {
    return "dormant";
  }

  const changeRatio = previousActivity > 0
    ? (recentActivity - previousActivity) / previousActivity
    : recentActivity > 0 ? 1 : 0;

  const levelRatio = overallAvg > 0 ? recentActivity / overallAvg : 0;

  if (previousActivity === 0 && recentActivity > 0) {
    return "emerging";
  }

  if (changeRatio > 0.2 && levelRatio > 0.8) {
    return "expansion";
  }

  if (changeRatio < -0.2) {
    return "declining";
  }

  return "consolidation";
}

/**
 * フェーズ遷移を検出
 */
export function detectPhaseTransition(
  activities: DailyActivity[]
): PhaseTransition {
  const weeklyData = getWeeklyActivity(activities);

  if (weeklyData.length < 4) {
    return {
      currentPhase: activities.length > 0 ? "emerging" : "dormant",
      previousPhase: null,
      transitionDate: null,
      stability: 0,
      daysInCurrentPhase: 0,
    };
  }

  // 全体の平均
  const overallAvg = weeklyData.reduce((s, w) => s + w.activity, 0) / weeklyData.length;

  // 直近4週間と前の4週間を比較
  const recent4Weeks = weeklyData.slice(-4);
  const previous4Weeks = weeklyData.slice(-8, -4);

  const recentActivity = recent4Weeks.reduce((s, w) => s + w.activity, 0) / recent4Weeks.length;
  const previousActivity = previous4Weeks.length > 0
    ? previous4Weeks.reduce((s, w) => s + w.activity, 0) / previous4Weeks.length
    : 0;

  const currentPhase = determinePhase(recentActivity, previousActivity, overallAvg);

  // 前のフェーズを判定（さらに前の4週間を使用）
  let previousPhase: Phase | null = null;
  let transitionDate: string | null = null;

  if (weeklyData.length >= 12) {
    const older4Weeks = weeklyData.slice(-12, -8);
    const olderActivity = older4Weeks.reduce((s, w) => s + w.activity, 0) / older4Weeks.length;
    previousPhase = determinePhase(previousActivity, olderActivity, overallAvg);

    if (previousPhase !== currentPhase && previous4Weeks.length > 0) {
      transitionDate = previous4Weeks[previous4Weeks.length - 1].weekStart;
    }
  }

  // 安定性（直近の変動の小ささ）
  const recentVariance = calculateVariance(recent4Weeks.map(w => w.activity));
  const stability = recentActivity > 0
    ? Math.max(0, 1 - Math.sqrt(recentVariance) / recentActivity)
    : 0;

  // 現在のフェーズに入ってからの日数
  let daysInCurrentPhase = 0;
  if (transitionDate) {
    const transitionDateObj = parseDate(transitionDate);
    const now = new Date();
    daysInCurrentPhase = Math.floor((now.getTime() - transitionDateObj.getTime()) / (24 * 60 * 60 * 1000));
  } else {
    // 遷移がない場合は最初のデータからの日数
    if (weeklyData.length > 0) {
      const firstDate = parseDate(weeklyData[0].weekStart);
      const now = new Date();
      daysInCurrentPhase = Math.floor((now.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1000));
    }
  }

  return {
    currentPhase,
    previousPhase,
    transitionDate,
    stability: round4(stability),
    daysInCurrentPhase,
  };
}

/**
 * 分散を計算
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

// ============================================================
// Insight Generation
// ============================================================

/**
 * インサイトを生成
 */
export function generateTimescaleInsight(
  trends: MultiScaleTrends,
  seasonal: SeasonalPattern,
  phase: PhaseTransition
): string {
  const parts: string[] = [];

  // トレンド分析
  if (trends.weekly.direction === "rising" && trends.quarterly.direction === "rising") {
    parts.push("短期・長期ともに成長トレンドにあります。");
  } else if (trends.weekly.direction === "rising" && trends.quarterly.direction === "stable") {
    parts.push("週次で活発化していますが、四半期では安定した水準です。");
  } else if (trends.weekly.direction === "falling" && trends.quarterly.direction === "rising") {
    parts.push("一時的な減少ですが、長期トレンドは上昇しています。");
  } else if (trends.weekly.direction === "falling" && trends.quarterly.direction === "falling") {
    parts.push("活動が減少傾向にあります。");
  }

  // 季節パターン
  if (seasonal.detected) {
    const peakStr = seasonal.peakMonths.map(m => `${m}月`).join("・");
    parts.push(`${peakStr}に活動がピークを迎える傾向があります。`);
  }

  // フェーズ
  const phaseDescriptions: Record<Phase, string> = {
    dormant: "現在は休眠期です。",
    emerging: "新たな活動が始まっています。",
    expansion: "拡大期にあり、活発な成長が見られます。",
    consolidation: "統合期で、知識が深化しています。",
    declining: "活動が減少しています。新たなインプットを検討してください。",
  };
  parts.push(phaseDescriptions[phase.currentPhase]);

  // 遷移情報
  if (phase.previousPhase && phase.transitionDate) {
    parts.push(`${phase.daysInCurrentPhase}日前に${phase.previousPhase}から遷移しました。`);
  }

  return parts.join(" ");
}

// ============================================================
// Main API Functions
// ============================================================

/**
 * 特定クラスターのマルチタイムスケール分析
 */
export async function analyzeClusterTimescales(
  clusterId: number
): Promise<ClusterTimescaleAnalysis | null> {
  const allActivities = await getClusterDailyActivity(365);
  const clusterActivities = filterByCluster(allActivities, clusterId);

  if (clusterActivities.length === 0) {
    return null;
  }

  const trends = calculateMultiScaleTrends(clusterActivities);
  const seasonalPattern = detectSeasonalPattern(clusterActivities);
  const phaseTransition = detectPhaseTransition(clusterActivities);
  const insight = generateTimescaleInsight(trends, seasonalPattern, phaseTransition);

  return {
    clusterId,
    trends,
    seasonalPattern,
    phaseTransition,
    insight,
  };
}

/**
 * 全体のマルチタイムスケール分析
 */
export async function analyzeGlobalTimescales(): Promise<GlobalTimescaleAnalysis> {
  const allActivities = await getClusterDailyActivity(365);

  if (allActivities.length === 0) {
    return {
      analysisDate: new Date().toISOString().split("T")[0],
      clusterCount: 0,
      activeClusterCount: 0,
      globalTrends: {
        weekly: { direction: "stable", velocity: 0, confidence: 0, dataPoints: 0 },
        monthly: { direction: "stable", velocity: 0, confidence: 0, dataPoints: 0 },
        quarterly: { direction: "stable", velocity: 0, confidence: 0, dataPoints: 0 },
      },
      topGrowingClusters: [],
      topDecliningClusters: [],
      seasonalPatterns: [],
      phaseTransitions: [],
    };
  }

  // 全体のトレンド
  const globalTrends = calculateMultiScaleTrends(allActivities);

  // クラスター別に分析
  const clusterIds = [...new Set(allActivities.map(a => a.clusterId))];
  const clusterAnalyses: Array<{
    clusterId: number;
    trends: MultiScaleTrends;
    seasonal: SeasonalPattern;
    phase: PhaseTransition;
  }> = [];

  for (const clusterId of clusterIds) {
    const activities = filterByCluster(allActivities, clusterId);
    const trends = calculateMultiScaleTrends(activities);
    const seasonal = detectSeasonalPattern(activities);
    const phase = detectPhaseTransition(activities);
    clusterAnalyses.push({ clusterId, trends, seasonal, phase });
  }

  // 成長・衰退クラスターをソート
  const sortedByGrowth = [...clusterAnalyses]
    .sort((a, b) => b.trends.quarterly.velocity - a.trends.quarterly.velocity);

  const topGrowingClusters = sortedByGrowth
    .filter(c => c.trends.quarterly.velocity > 0)
    .slice(0, 5)
    .map(c => ({ clusterId: c.clusterId, velocity: c.trends.quarterly.velocity }));

  const topDecliningClusters = sortedByGrowth
    .filter(c => c.trends.quarterly.velocity < 0)
    .slice(-5)
    .reverse()
    .map(c => ({ clusterId: c.clusterId, velocity: c.trends.quarterly.velocity }));

  // 季節パターンが検出されたクラスター
  const seasonalPatterns = clusterAnalyses
    .filter(c => c.seasonal.detected)
    .map(c => ({ clusterId: c.clusterId, pattern: c.seasonal }));

  // フェーズ遷移があったクラスター
  const phaseTransitions = clusterAnalyses
    .filter(c => c.phase.previousPhase !== null)
    .map(c => ({ clusterId: c.clusterId, transition: c.phase }));

  // アクティブなクラスター（直近30日に活動あり）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const activeClusterIds = new Set(
    allActivities
      .filter(a => a.date >= thirtyDaysAgoStr)
      .map(a => a.clusterId)
  );

  return {
    analysisDate: new Date().toISOString().split("T")[0],
    clusterCount: clusterIds.length,
    activeClusterCount: activeClusterIds.size,
    globalTrends,
    topGrowingClusters,
    topDecliningClusters,
    seasonalPatterns,
    phaseTransitions,
  };
}
