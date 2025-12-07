import { Hono } from "hono";
import {
  buildDriftTimeline,
  getStateDescription,
} from "../../services/drift/driftService";
import {
  getDailyDriftData,
  calcGrowthAngle,
  calcDriftForecast,
  detectWarning,
  generateDriftInsight,
} from "../../services/drift/driftCore";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";

export const driftRoute = new Hono();

/**
 * GET /api/drift/timeline
 * Drift Timeline（成長の折れ線グラフ）を取得
 *
 * Query:
 * - range: 日数（default: "90d"）
 *
 * Response:
 * - range: "90d"
 * - days: [{ date, drift, ema }]
 * - summary: { todayDrift, todayEMA, state, trend, mean, stdDev }
 * - description: 状態の日本語説明
 */
driftRoute.get("/timeline", async (c) => {
  const rangeParam = c.req.query("range") ?? "90d";

  // パース: "90d" → 90, "30d" → 30
  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 90;

  if (isNaN(rangeDays) || rangeDays < 1 || rangeDays > 365) {
    return c.json({ error: "Invalid range. Use format: 30d, 90d, etc." }, 400);
  }

  const timeline = await buildDriftTimeline(rangeDays);
  const description = getStateDescription(timeline.summary);

  return c.json({
    ...timeline,
    description,
  });
});

/**
 * GET /api/drift/events
 * Drift Events（成長の転換点）を取得
 *
 * Query:
 * - range: 日数（default: "30d"）
 * - severity: "all" | "high" | "mid" | "low" (default: "all")
 */
driftRoute.get("/events", async (c) => {
  const rangeParam = c.req.query("range") ?? "30d";
  const severity = c.req.query("severity") ?? "all";

  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 30;

  if (isNaN(rangeDays) || rangeDays < 1 || rangeDays > 365) {
    return c.json({ error: "Invalid range" }, 400);
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);

  let events;
  if (severity === "all") {
    events = await db.all<{
      id: number;
      detected_at: number;
      severity: string;
      type: string;
      message: string;
      related_cluster: number | null;
    }>(sql`
      SELECT id, detected_at, severity, type, message, related_cluster
      FROM drift_events
      WHERE detected_at >= ${startTimestamp}
      ORDER BY detected_at DESC
    `);
  } else {
    events = await db.all<{
      id: number;
      detected_at: number;
      severity: string;
      type: string;
      message: string;
      related_cluster: number | null;
    }>(sql`
      SELECT id, detected_at, severity, type, message, related_cluster
      FROM drift_events
      WHERE detected_at >= ${startTimestamp}
        AND severity = ${severity}
      ORDER BY detected_at DESC
    `);
  }

  // フォーマット
  const formattedEvents = events.map((e) => ({
    id: e.id,
    detectedAt: new Date(e.detected_at * 1000).toISOString(),
    date: new Date(e.detected_at * 1000).toISOString().split("T")[0],
    severity: e.severity,
    type: e.type,
    message: e.message,
    relatedCluster: e.related_cluster,
  }));

  // 統計
  const stats = {
    total: events.length,
    high: events.filter((e) => e.severity === "high").length,
    mid: events.filter((e) => e.severity === "mid").length,
    low: events.filter((e) => e.severity === "low").length,
  };

  return c.json({
    range: `${rangeDays}d`,
    severity: severity,
    stats,
    events: formattedEvents,
  });
});

/**
 * GET /api/drift/summary
 * Drift の現在状態サマリーを取得（GPT向け）
 */
driftRoute.get("/summary", async (c) => {
  // 過去30日のタイムラインを取得
  const timeline = await buildDriftTimeline(30);
  const description = getStateDescription(timeline.summary);

  // 最新のイベント5件
  const recentEvents = await db.all<{
    detected_at: number;
    severity: string;
    type: string;
    message: string;
  }>(sql`
    SELECT detected_at, severity, type, message
    FROM drift_events
    ORDER BY detected_at DESC
    LIMIT 5
  `);

  return c.json({
    current: {
      ...timeline.summary,
      description,
    },
    recentEvents: recentEvents.map((e) => ({
      date: new Date(e.detected_at * 1000).toISOString().split("T")[0],
      severity: e.severity,
      type: e.type,
      message: e.message,
    })),
    advice: generateAdvice(timeline.summary),
  });
});

/**
 * 状態に応じたアドバイスを生成
 */
function generateAdvice(summary: {
  state: string;
  trend: string;
  todayEMA: number;
  mean: number;
}): string {
  const { state, trend } = summary;

  if (state === "overheat" && trend === "rising") {
    return "思考が過熱しています。一度立ち止まって、今日の学びを整理してみましょう。";
  }

  if (state === "overheat") {
    return "活発な思考活動が続いています。振り返りの時間を設けると良いかもしれません。";
  }

  if (state === "stagnation" && trend === "falling") {
    return "思考が停滞気味です。新しい情報や異なる視点に触れてみましょう。";
  }

  if (state === "stagnation") {
    return "少しペースが落ちています。小さなアイデアでも書き留めることから始めてみましょう。";
  }

  if (trend === "rising") {
    return "良い成長リズムです。この調子で続けましょう。";
  }

  if (trend === "falling") {
    return "成長ペースが落ち着いてきました。定着のフェーズかもしれません。";
  }

  return "安定した成長を続けています。";
}

/**
 * GET /api/drift/angle
 * Growth Angle（成長角度）を取得
 *
 * A. 成長の方向と速度を分析
 */
driftRoute.get("/angle", async (c) => {
  const rangeParam = c.req.query("range") ?? "30d";
  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 30;

  const data = await getDailyDriftData(rangeDays);
  const angle = calcGrowthAngle(data);

  const description = getAngleDescription(angle);

  return c.json({
    range: `${rangeDays}d`,
    ...angle,
    description,
  });
});

function getAngleDescription(angle: {
  trend: string;
  angleDegrees: number;
  velocity: number;
}): string {
  if (angle.trend === "rising") {
    if (angle.angleDegrees > 30) {
      return "今日は成長角度が非常に鋭く、理解が急速に深まっています。";
    }
    return "成長が加速しています。良いリズムです。";
  }

  if (angle.trend === "falling") {
    if (angle.angleDegrees < -30) {
      return "成長ペースが大きく落ちています。休息が必要かもしれません。";
    }
    return "成長ペースが落ち着いてきました。定着フェーズに入っています。";
  }

  return "安定した成長リズムを維持しています。";
}

/**
 * GET /api/drift/forecast
 * Drift Forecast（ドリフト予測）を取得
 *
 * B. 3日後・7日後の成長予測
 */
driftRoute.get("/forecast", async (c) => {
  const rangeParam = c.req.query("range") ?? "30d";
  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 30;

  const data = await getDailyDriftData(rangeDays);
  const angle = calcGrowthAngle(data);
  const forecast = calcDriftForecast(data, angle);

  const interpretation = getForecastInterpretation(forecast, angle);

  return c.json({
    range: `${rangeDays}d`,
    ...forecast,
    currentEMA: data.length > 0 ? data[data.length - 1].ema : 0,
    interpretation,
  });
});

function getForecastInterpretation(
  forecast: { forecast3d: number; forecast7d: number; confidence: string },
  angle: { trend: string }
): string {
  if (angle.trend === "rising") {
    return "今のペースを維持すれば成長が加速する見込みです。";
  }

  if (angle.trend === "falling") {
    return "成長ペースが落ち着く見込みです。統合・振り返りの良いタイミングかもしれません。";
  }

  return "安定した成長が続く見込みです。";
}

/**
 * GET /api/drift/warning
 * Warning System（警告システム）を取得
 *
 * C. 過熱・停滞の検出
 */
driftRoute.get("/warning", async (c) => {
  const rangeParam = c.req.query("range") ?? "30d";
  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 30;

  const data = await getDailyDriftData(rangeDays);
  const warning = detectWarning(data);

  return c.json({
    range: `${rangeDays}d`,
    ...warning,
  });
});

/**
 * GET /api/drift/insight
 * 統合 Insight（GPT向け完全版）
 *
 * A（角度）+ B（予測）+ C（警告）+ モード + アドバイス
 */
driftRoute.get("/insight", async (c) => {
  const rangeParam = c.req.query("range") ?? "30d";
  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 30;

  const insight = await generateDriftInsight(rangeDays);

  return c.json({
    range: `${rangeDays}d`,
    ...insight,
  });
})
