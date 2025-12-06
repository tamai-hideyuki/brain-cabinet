import { Hono } from "hono";
import {
  parseDateRange,
  getSemanticDiffTimeline,
  getClusterJourney,
  getDailyActivity,
  getTrendStats,
  getSummaryStats,
  type TimeUnit,
} from "../../services/analyticsService";

export const analyticsRoute = new Hono();

/**
 * GET /api/analytics/summary
 * サマリー統計を取得
 */
analyticsRoute.get("/summary", async (c) => {
  const stats = await getSummaryStats();
  return c.json(stats);
});

/**
 * GET /api/analytics/timeline
 * Semantic Diff の時系列データを取得
 * Query: range (default: "30d")
 */
analyticsRoute.get("/timeline", async (c) => {
  const range = c.req.query("range") ?? "30d";
  const dateRange = parseDateRange(range);
  const timeline = await getSemanticDiffTimeline(dateRange);

  return c.json({
    range,
    startDate: new Date(dateRange.start * 1000).toISOString().split("T")[0],
    endDate: new Date(dateRange.end * 1000).toISOString().split("T")[0],
    data: timeline,
  });
});

/**
 * GET /api/analytics/journey
 * クラスタ遷移履歴を取得
 * Query: range (default: "90d")
 */
analyticsRoute.get("/journey", async (c) => {
  const range = c.req.query("range") ?? "90d";
  const dateRange = parseDateRange(range);
  const journey = await getClusterJourney(dateRange);

  // クラスタごとにグループ化
  const byCluster = new Map<number | null, typeof journey>();
  for (const point of journey) {
    const list = byCluster.get(point.clusterId) ?? [];
    list.push(point);
    byCluster.set(point.clusterId, list);
  }

  const clusterSummary = Array.from(byCluster.entries()).map(([clusterId, points]) => ({
    clusterId,
    noteCount: points.length,
    notes: points.map((p) => ({ noteId: p.noteId, title: p.title, date: p.date })),
  }));

  return c.json({
    range,
    startDate: new Date(dateRange.start * 1000).toISOString().split("T")[0],
    endDate: new Date(dateRange.end * 1000).toISOString().split("T")[0],
    totalNotes: journey.length,
    byCluster: clusterSummary,
    timeline: journey,
  });
});

/**
 * GET /api/analytics/heatmap
 * 年間活動ヒートマップを取得
 * Query: year (default: current year)
 */
analyticsRoute.get("/heatmap", async (c) => {
  const yearParam = c.req.query("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return c.json({ error: "Invalid year" }, 400);
  }

  const heatmap = await getDailyActivity(year);

  // 週ごとにグループ化（GitHub風表示用）
  const weeks: Array<typeof heatmap> = [];
  let currentWeek: typeof heatmap = [];

  for (const day of heatmap) {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay(); // 0 = Sunday

    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // 統計
  const totalActivity = heatmap.reduce((sum, d) => sum + d.count, 0);
  const activeDays = heatmap.filter((d) => d.count > 0).length;
  const maxCount = Math.max(...heatmap.map((d) => d.count));

  return c.json({
    year,
    totalActivity,
    activeDays,
    maxDailyCount: maxCount,
    weeks,
    days: heatmap,
  });
});

/**
 * GET /api/analytics/trends
 * クラスタ別トレンドを取得
 * Query: unit ("week" | "month", default: "month"), range (default: "6m")
 */
analyticsRoute.get("/trends", async (c) => {
  const unitParam = c.req.query("unit") ?? "month";
  const range = c.req.query("range") ?? "6m";

  const unit: TimeUnit = unitParam === "week" ? "week" : "month";
  const dateRange = parseDateRange(range);
  const trends = await getTrendStats(unit, dateRange);

  // 期間ごとにまとめる
  const byPeriod = new Map<string, Array<{ clusterId: number; count: number }>>();
  for (const item of trends) {
    const list = byPeriod.get(item.period) ?? [];
    list.push({ clusterId: item.clusterId, count: item.count });
    byPeriod.set(item.period, list);
  }

  const periodSummary = Array.from(byPeriod.entries())
    .map(([period, clusters]) => ({
      period,
      totalNotes: clusters.reduce((sum, c) => sum + c.count, 0),
      clusters: clusters.sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return c.json({
    unit,
    range,
    startDate: new Date(dateRange.start * 1000).toISOString().split("T")[0],
    endDate: new Date(dateRange.end * 1000).toISOString().split("T")[0],
    periods: periodSummary,
    raw: trends,
  });
});
