/**
 * Drift Core Engine (v3)
 *
 * A（Growth Angle）・B（Drift Forecast）・C（Warning System）
 * を統合した Drift Predictor のコアエンジン
 *
 * すべての成長分析機能がこのモジュールを中心に動作する
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// ============================================================
// 設定値
// ============================================================

const EMA_ALPHA = 0.3; // 平滑化係数
const OVERHEAT_SIGMA = 1.5; // 過熱判定：mean + 1.5σ
const STAGNATION_SIGMA = 1.0; // 停滞判定：mean - 1.0σ
const TREND_THRESHOLD = 0.05; // トレンド判定：5%以上の変化

// ============================================================
// 型定義
// ============================================================

export type DailyDrift = {
  date: string;
  drift: number;
  ema: number;
};

export type GrowthAngle = {
  angle: number; // ラジアン
  angleDegrees: number; // 度
  trend: "rising" | "falling" | "flat";
  velocity: number; // 変化速度
};

export type DriftForecast = {
  forecast3d: number;
  forecast7d: number;
  confidence: "high" | "medium" | "low";
};

export type DriftWarning = {
  state: "stable" | "overheat" | "stagnation";
  severity: "none" | "low" | "mid" | "high";
  recommendation: string;
};

export type DriftMode =
  | "exploration" // 探索フェーズ
  | "consolidation" // 統合フェーズ
  | "growth" // 成長フェーズ
  | "rest"; // 休息フェーズ

export type DriftInsight = {
  angle: GrowthAngle;
  forecast: DriftForecast;
  warning: DriftWarning;
  mode: DriftMode;
  advice: string;
  todayDrift: number;
  todayEMA: number;
};

// ============================================================
// Core Functions
// ============================================================

/**
 * 日別ドリフトデータを取得
 */
export async function getDailyDriftData(
  rangeDays: number = 30
): Promise<DailyDrift[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);

  const rows = await db.all<{
    date: string;
    total: number;
  }>(sql`
    SELECT
      date(created_at, 'unixepoch') as date,
      SUM(CAST(semantic_diff AS REAL)) as total
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND created_at >= ${startTimestamp}
    GROUP BY date(created_at, 'unixepoch')
    ORDER BY date ASC
  `);

  // EMA を計算
  const data: DailyDrift[] = [];
  let prevEMA = rows.length > 0 ? rows[0].total : 0;

  for (let i = 0; i < rows.length; i++) {
    const drift = rows[i].total || 0;
    const ema =
      i === 0 ? drift : EMA_ALPHA * drift + (1 - EMA_ALPHA) * prevEMA;

    data.push({
      date: rows[i].date,
      drift: round4(drift),
      ema: round4(ema),
    });

    prevEMA = ema;
  }

  return data;
}

/**
 * EMA を計算（汎用関数）
 */
export function calcEMA(values: number[], alpha: number = EMA_ALPHA): number[] {
  if (values.length === 0) return [];

  let ema = values[0];
  const result = [ema];

  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
    result.push(ema);
  }

  return result;
}

/**
 * A. Growth Angle（成長角度）を計算
 *
 * angle = atan(drift[today] - drift[yesterday])
 */
export function calcGrowthAngle(data: DailyDrift[]): GrowthAngle {
  if (data.length < 2) {
    return {
      angle: 0,
      angleDegrees: 0,
      trend: "flat",
      velocity: 0,
    };
  }

  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];

  // EMA の差分から角度を計算
  const diff = today.ema - yesterday.ema;
  const angle = Math.atan(diff);
  const angleDegrees = (angle * 180) / Math.PI;

  // トレンド判定
  const relativeChange = yesterday.ema > 0 ? diff / yesterday.ema : 0;
  let trend: "rising" | "falling" | "flat";

  if (relativeChange > TREND_THRESHOLD) {
    trend = "rising";
  } else if (relativeChange < -TREND_THRESHOLD) {
    trend = "falling";
  } else {
    trend = "flat";
  }

  return {
    angle: round4(angle),
    angleDegrees: round4(angleDegrees),
    trend,
    velocity: round4(diff),
  };
}

/**
 * B. Drift Forecast（ドリフト予測）
 *
 * 線形外挿：forecast[n] = EMA_today + velocity * n
 */
export function calcDriftForecast(
  data: DailyDrift[],
  angle: GrowthAngle
): DriftForecast {
  if (data.length === 0) {
    return {
      forecast3d: 0,
      forecast7d: 0,
      confidence: "low",
    };
  }

  const todayEMA = data[data.length - 1].ema;
  const velocity = angle.velocity;

  // 線形予測
  const forecast3d = Math.max(0, todayEMA + velocity * 3);
  const forecast7d = Math.max(0, todayEMA + velocity * 7);

  // 信頼度判定（データ量に基づく）
  let confidence: "high" | "medium" | "low";
  if (data.length >= 14) {
    confidence = "high";
  } else if (data.length >= 7) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    forecast3d: round4(forecast3d),
    forecast7d: round4(forecast7d),
    confidence,
  };
}

/**
 * C. Warning System（警告システム）
 *
 * overheat: EMA > mean + 1.5σ
 * stagnation: EMA < mean - 1.0σ
 */
export function detectWarning(data: DailyDrift[]): DriftWarning {
  if (data.length < 3) {
    return {
      state: "stable",
      severity: "none",
      recommendation: "データが不足しています。継続してノートを記録してください。",
    };
  }

  const emaValues = data.map((d) => d.ema);
  const { mean, stdDev } = calcStats(emaValues);
  const todayEMA = emaValues[emaValues.length - 1];

  // 過熱判定
  if (todayEMA > mean + OVERHEAT_SIGMA * stdDev) {
    const severity =
      todayEMA > mean + 2 * stdDev
        ? "high"
        : todayEMA > mean + 1.5 * stdDev
          ? "mid"
          : "low";

    return {
      state: "overheat",
      severity,
      recommendation:
        "知的活動が過剰です。一度立ち止まって、学んだことを整理・統合する時間を取りましょう。",
    };
  }

  // 停滞判定
  if (todayEMA < mean - STAGNATION_SIGMA * stdDev) {
    const severity =
      todayEMA < mean - 2 * stdDev
        ? "high"
        : todayEMA < mean - 1.5 * stdDev
          ? "mid"
          : "low";

    return {
      state: "stagnation",
      severity,
      recommendation:
        "思考活動が停滞しています。新しい情報に触れるか、異なる視点からアプローチしてみましょう。",
    };
  }

  return {
    state: "stable",
    severity: "none",
    recommendation: "安定した成長リズムです。この調子を維持しましょう。",
  };
}

/**
 * Drift Mode（成長モード）を判定
 */
export function detectDriftMode(
  angle: GrowthAngle,
  warning: DriftWarning
): DriftMode {
  // 過熱時は休息推奨
  if (warning.state === "overheat") {
    return "rest";
  }

  // 停滞時は探索推奨
  if (warning.state === "stagnation") {
    return "exploration";
  }

  // 上昇トレンド → 成長フェーズ
  if (angle.trend === "rising") {
    return "growth";
  }

  // 下降トレンド → 統合フェーズ
  if (angle.trend === "falling") {
    return "consolidation";
  }

  // フラット → 安定成長
  return "consolidation";
}

/**
 * 統合 Insight を生成
 */
export async function generateDriftInsight(
  rangeDays: number = 30
): Promise<DriftInsight> {
  const data = await getDailyDriftData(rangeDays);
  const angle = calcGrowthAngle(data);
  const forecast = calcDriftForecast(data, angle);
  const warning = detectWarning(data);
  const mode = detectDriftMode(angle, warning);

  const today = data.length > 0 ? data[data.length - 1] : null;
  const advice = generateAdvice(angle, warning, mode);

  return {
    angle,
    forecast,
    warning,
    mode,
    advice,
    todayDrift: today?.drift ?? 0,
    todayEMA: today?.ema ?? 0,
  };
}

/**
 * アドバイスを生成
 */
function generateAdvice(
  angle: GrowthAngle,
  warning: DriftWarning,
  mode: DriftMode
): string {
  // 警告状態優先
  if (warning.state !== "stable") {
    return warning.recommendation;
  }

  // モード別アドバイス
  switch (mode) {
    case "exploration":
      return "探索フェーズです。新しいテーマのノートを書くと成長が加速します。";
    case "consolidation":
      return "統合フェーズです。既存のノートを振り返り、つながりを見つけましょう。";
    case "growth":
      return "成長フェーズです。今の勢いを活かして深掘りを続けましょう。";
    case "rest":
      return "休息フェーズです。学んだことが定着するまで少し休みましょう。";
    default:
      return "安定した成長リズムです。";
  }
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 平均と標準偏差を計算
 */
function calcStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * 小数点4桁で丸める
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
