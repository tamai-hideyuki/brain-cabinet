import { Hono } from "hono";
import {
  buildDriftTimeline,
  getStateDescription,
} from "../../services/drift/driftService";
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
