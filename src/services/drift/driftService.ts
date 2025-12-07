/**
 * Drift Timeline Service (v3)
 *
 * 成長の折れ線グラフを生成するためのコアロジック
 *
 * - 日別の semantic_diff を集計
 * - EMA（指数移動平均）で滑らか化
 * - 成長状態（stable / overheat / stagnation）を判定
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// EMA の平滑化係数（0.3 = 変化に敏感すぎず鈍感すぎない）
const EMA_ALPHA = 0.3;

// 状態判定の閾値（標準偏差の倍数）
const OVERHEAT_THRESHOLD = 1.5; // mean + 1.5σ 以上
const STAGNATION_THRESHOLD = 1.0; // mean - 1.0σ 以下

export type DailyDriftRaw = {
  date: string;
  total: number;
  count: number;
};

export type DailyDriftWithEMA = {
  date: string;
  drift: number; // 日別の合計 drift
  ema: number; // EMA
};

export type DriftState = "stable" | "overheat" | "stagnation";
export type DriftTrend = "rising" | "falling" | "flat";

export type DriftTimelineSummary = {
  todayDrift: number;
  todayEMA: number;
  state: DriftState;
  trend: DriftTrend;
  mean: number;
  stdDev: number;
};

export type DriftTimelineResponse = {
  range: string;
  days: DailyDriftWithEMA[];
  summary: DriftTimelineSummary;
};

/**
 * 日別の drift raw データを取得
 */
export async function getDailyDriftRaw(
  rangeDays: number = 90
): Promise<DailyDriftRaw[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);

  const rows = await db.all<{
    date: string;
    total: number;
    count: number;
  }>(sql`
    SELECT
      date(created_at, 'unixepoch') as date,
      SUM(CAST(semantic_diff AS REAL)) as total,
      COUNT(*) as count
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND created_at >= ${startTimestamp}
    GROUP BY date(created_at, 'unixepoch')
    ORDER BY date ASC
  `);

  return rows.map((row) => ({
    date: row.date,
    total: row.total || 0,
    count: row.count || 0,
  }));
}

/**
 * EMA（指数移動平均）を計算
 */
export function calculateEMA(
  data: DailyDriftRaw[],
  alpha: number = EMA_ALPHA
): DailyDriftWithEMA[] {
  if (data.length === 0) return [];

  const result: DailyDriftWithEMA[] = [];
  let prevEMA = data[0].total;

  for (let i = 0; i < data.length; i++) {
    const drift = data[i].total;
    const ema = i === 0 ? drift : alpha * drift + (1 - alpha) * prevEMA;

    result.push({
      date: data[i].date,
      drift: Math.round(drift * 10000) / 10000,
      ema: Math.round(ema * 10000) / 10000,
    });

    prevEMA = ema;
  }

  return result;
}

/**
 * 平均と標準偏差を計算
 */
function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * ドリフト状態を判定
 */
export function classifyDriftState(
  currentEMA: number,
  mean: number,
  stdDev: number
): DriftState {
  if (stdDev === 0) return "stable";

  if (currentEMA > mean + OVERHEAT_THRESHOLD * stdDev) {
    return "overheat";
  }

  if (currentEMA < mean - STAGNATION_THRESHOLD * stdDev) {
    return "stagnation";
  }

  return "stable";
}

/**
 * トレンド（傾向）を判定
 */
export function classifyTrend(
  days: DailyDriftWithEMA[],
  lookbackDays: number = 3
): DriftTrend {
  if (days.length < 2) return "flat";

  const recent = days.slice(-lookbackDays);
  if (recent.length < 2) return "flat";

  const firstEMA = recent[0].ema;
  const lastEMA = recent[recent.length - 1].ema;
  const diff = lastEMA - firstEMA;

  // 5%以上の変化で rising/falling 判定
  const threshold = firstEMA * 0.05;

  if (diff > threshold) return "rising";
  if (diff < -threshold) return "falling";
  return "flat";
}

/**
 * Drift Timeline を構築
 */
export async function buildDriftTimeline(
  rangeDays: number = 90
): Promise<DriftTimelineResponse> {
  // 1. Raw データ取得
  const rawData = await getDailyDriftRaw(rangeDays);

  // 2. EMA 計算
  const days = calculateEMA(rawData);

  // 3. 統計計算（過去30日分）
  const recentDays = days.slice(-30);
  const emaValues = recentDays.map((d) => d.ema);
  const { mean, stdDev } = calculateStats(emaValues);

  // 4. 今日の状態を判定
  const today = days.length > 0 ? days[days.length - 1] : null;
  const todayDrift = today?.drift ?? 0;
  const todayEMA = today?.ema ?? 0;

  const state = classifyDriftState(todayEMA, mean, stdDev);
  const trend = classifyTrend(days);

  return {
    range: `${rangeDays}d`,
    days,
    summary: {
      todayDrift: Math.round(todayDrift * 10000) / 10000,
      todayEMA: Math.round(todayEMA * 10000) / 10000,
      state,
      trend,
      mean: Math.round(mean * 10000) / 10000,
      stdDev: Math.round(stdDev * 10000) / 10000,
    },
  };
}

/**
 * 状態を日本語で説明
 */
export function getStateDescription(
  summary: DriftTimelineSummary
): string {
  const { state, trend, todayEMA, mean } = summary;

  let stateDesc = "";
  switch (state) {
    case "overheat":
      stateDesc = "思考が活発すぎる状態です。少し落ち着いて整理する時間が必要かもしれません。";
      break;
    case "stagnation":
      stateDesc = "思考が停滞気味です。新しいインプットや視点の転換が効果的かもしれません。";
      break;
    default:
      stateDesc = "安定した成長ペースです。";
  }

  let trendDesc = "";
  switch (trend) {
    case "rising":
      trendDesc = "成長速度が上昇しています。";
      break;
    case "falling":
      trendDesc = "成長速度が落ち着いてきています。";
      break;
    default:
      trendDesc = "成長速度は横ばいです。";
  }

  return `${stateDesc} ${trendDesc}`;
}
