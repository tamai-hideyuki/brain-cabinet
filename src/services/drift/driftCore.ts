/**
 * Drift Core Engine (v3)
 *
 * A（Growth Angle）・B（Drift Forecast）・C（Warning System）
 * を統合した Drift Predictor のコアエンジン
 *
 * すべての成長分析機能がこのモジュールを中心に動作する
 */

import * as driftRepo from "../../repositories/driftRepo";

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

/**
 * v7.4: Extended Warning with Phase Context
 *
 * phaseと組み合わせて、過熱/停滞の質を判定
 * - creative_overheat: 創造的な過熱（良い状態）
 * - destructive_overheat: 消耗的な過熱（注意が必要）
 * - exploratory_stagnation: 探索中の停滞
 * - rest_stagnation: 休息中の停滞
 */
export type ExtendedWarningType =
  | "creative_overheat"
  | "destructive_overheat"
  | "neutral_overheat"
  | "exploratory_stagnation"
  | "rest_stagnation"
  | "deepening_stagnation"
  | "stable";

export type ExtendedWarning = {
  baseState: "stable" | "overheat" | "stagnation";
  extendedType: ExtendedWarningType;
  phase: "creation" | "destruction" | "neutral" | null;
  severity: "none" | "low" | "mid" | "high";
  isCreativeOverheat: boolean;
  recommendation: string;
  insight: string;
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
  extendedWarning?: ExtendedWarning; // v7.4
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

  const rows = await driftRepo.findDailyDriftData(startTimestamp);

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
 * v7.4: Extended Warning（拡張警告）を検出
 *
 * 基本の warning と phase を組み合わせて、過熱/停滞の質を判定
 */
export function detectExtendedWarning(
  warning: DriftWarning,
  phase: "creation" | "destruction" | "neutral" | null
): ExtendedWarning {
  const baseState = warning.state;

  // Stable の場合
  if (baseState === "stable") {
    return {
      baseState: "stable",
      extendedType: "stable",
      phase,
      severity: "none",
      isCreativeOverheat: false,
      recommendation: warning.recommendation,
      insight: "安定した成長リズムを維持しています。",
    };
  }

  // Overheat の場合
  if (baseState === "overheat") {
    if (phase === "creation") {
      // Creative Overheat: 創造的な過熱（良い状態だが持続不可能）
      return {
        baseState: "overheat",
        extendedType: "creative_overheat",
        phase,
        severity: warning.severity,
        isCreativeOverheat: true,
        recommendation:
          "創造的な活動が活発です！この勢いを活かしつつ、適度な休息も取り入れましょう。",
        insight:
          "新しいアイデアや発見が多い「創造的過熱」状態です。燃え尽きないよう、成果を記録しながら進みましょう。",
      };
    } else if (phase === "destruction") {
      // Destructive Overheat: 消耗的な過熱（注意が必要）
      return {
        baseState: "overheat",
        extendedType: "destructive_overheat",
        phase,
        severity: warning.severity,
        isCreativeOverheat: false,
        recommendation:
          "思考が収束方向に過剰に働いています。一度離れて、新しい視点を取り入れましょう。",
        insight:
          "既存の知識を整理・削減する活動が過剰な「消耗的過熱」状態です。インプットを増やすことをお勧めします。",
      };
    } else {
      // Neutral Overheat: 中立的な過熱
      return {
        baseState: "overheat",
        extendedType: "neutral_overheat",
        phase,
        severity: warning.severity,
        isCreativeOverheat: false,
        recommendation:
          "活動量が多い状態です。方向性を確認し、創造か統合かを意識してみましょう。",
        insight:
          "活動量は多いが方向性が定まっていない状態です。目的を明確にすると効果的です。",
      };
    }
  }

  // Stagnation の場合
  if (baseState === "stagnation") {
    if (phase === "creation") {
      // Exploratory Stagnation: 探索中の停滞
      return {
        baseState: "stagnation",
        extendedType: "exploratory_stagnation",
        phase,
        severity: warning.severity,
        isCreativeOverheat: false,
        recommendation:
          "新しいことを探索しようとしていますが、ペースが落ちています。小さなステップから始めましょう。",
        insight:
          "探索意欲はあるが行動が伴っていない状態です。ハードルを下げて小さく始めることをお勧めします。",
      };
    } else if (phase === "destruction") {
      // Deepening Stagnation: 深化中の停滞
      return {
        baseState: "stagnation",
        extendedType: "deepening_stagnation",
        phase,
        severity: warning.severity,
        isCreativeOverheat: false,
        recommendation:
          "既存知識の整理が停滞しています。異なる分野との接点を探してみましょう。",
        insight:
          "収束・整理のフェーズで停滞しています。新しい刺激を取り入れると活性化します。",
      };
    } else {
      // Rest Stagnation: 休息中の停滞
      return {
        baseState: "stagnation",
        extendedType: "rest_stagnation",
        phase,
        severity: warning.severity,
        isCreativeOverheat: false,
        recommendation:
          "休息期間が続いています。無理せず、興味のあることから少しずつ再開しましょう。",
        insight:
          "思考活動が休息状態です。これは自然なサイクルの一部かもしれません。",
      };
    }
  }

  // Fallback
  return {
    baseState,
    extendedType: "stable",
    phase,
    severity: warning.severity,
    isCreativeOverheat: false,
    recommendation: warning.recommendation,
    insight: "状態を分析中です。",
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
 *
 * @param rangeDays - 取得する日数（デフォルト: 30日）
 * @param todayPhase - 今日のphase（v7.4: ExtendedWarning計算用）
 */
export async function generateDriftInsight(
  rangeDays: number = 30,
  todayPhase?: "creation" | "destruction" | "neutral" | null
): Promise<DriftInsight> {
  const data = await getDailyDriftData(rangeDays);
  const angle = calcGrowthAngle(data);
  const forecast = calcDriftForecast(data, angle);
  const warning = detectWarning(data);
  const mode = detectDriftMode(angle, warning);

  const today = data.length > 0 ? data[data.length - 1] : null;

  // v7.4: phaseが渡されていない場合は、driftServiceから今日のphaseを取得
  let phase = todayPhase;
  if (phase === undefined && today) {
    try {
      const { getDailyPhases } = await import("./driftService");
      const phases = await getDailyPhases(7); // 直近7日分
      phase = phases.get(today.date) ?? null;
    } catch {
      phase = null;
    }
  }

  // v7.4: Extended Warning を計算
  const extendedWarning = detectExtendedWarning(warning, phase ?? null);

  // アドバイスは拡張警告のものを優先
  const advice =
    warning.state !== "stable"
      ? extendedWarning.recommendation
      : generateAdvice(angle, warning, mode);

  return {
    angle,
    forecast,
    warning,
    extendedWarning,
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
