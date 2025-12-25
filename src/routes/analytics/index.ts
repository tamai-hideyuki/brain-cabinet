import { Hono } from "hono";
import {
  parseDateRange,
  getSemanticDiffTimeline,
  getClusterJourney,
  getDailyActivity,
  getTrendStats,
  getSummaryStats,
  type TimeUnit,
} from "../../services/analytics";
import {
  analyzeClusterTimescales,
  analyzeGlobalTimescales,
} from "../../services/analytics/multiTimescale";
import { getOrCompute, generateCacheKey } from "../../services/cache";

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

// ============================================================
// v5.9 マルチタイムスケール分析
// ============================================================

/**
 * GET /api/analytics/timescale
 * 全体のマルチタイムスケール分析を取得
 */
analyticsRoute.get("/timescale", async (c) => {
  const cacheKey = generateCacheKey("analytics_timescale", {});
  const analysis = await getOrCompute(
    cacheKey,
    "analytics_timescale",
    () => analyzeGlobalTimescales()
  );

  return c.json({
    analysisDate: analysis.analysisDate,
    overview: {
      clusterCount: analysis.clusterCount,
      activeClusterCount: analysis.activeClusterCount,
    },
    globalTrends: {
      weekly: {
        direction: analysis.globalTrends.weekly.direction,
        velocity: analysis.globalTrends.weekly.velocity,
        confidence: analysis.globalTrends.weekly.confidence,
      },
      monthly: {
        direction: analysis.globalTrends.monthly.direction,
        velocity: analysis.globalTrends.monthly.velocity,
        confidence: analysis.globalTrends.monthly.confidence,
      },
      quarterly: {
        direction: analysis.globalTrends.quarterly.direction,
        velocity: analysis.globalTrends.quarterly.velocity,
        confidence: analysis.globalTrends.quarterly.confidence,
      },
    },
    topGrowingClusters: analysis.topGrowingClusters,
    topDecliningClusters: analysis.topDecliningClusters,
    seasonalPatterns: analysis.seasonalPatterns.map((sp) => ({
      clusterId: sp.clusterId,
      peakMonths: sp.pattern.peakMonths,
      troughMonths: sp.pattern.troughMonths,
      amplitude: sp.pattern.amplitude,
    })),
    phaseTransitions: analysis.phaseTransitions.map((pt) => ({
      clusterId: pt.clusterId,
      currentPhase: pt.transition.currentPhase,
      previousPhase: pt.transition.previousPhase,
      transitionDate: pt.transition.transitionDate,
      daysInCurrentPhase: pt.transition.daysInCurrentPhase,
    })),
  });
});

/**
 * GET /api/analytics/timescale/cluster/:id
 * 特定クラスターのマルチタイムスケール分析を取得
 */
analyticsRoute.get("/timescale/cluster/:id", async (c) => {
  const idParam = c.req.param("id");
  const clusterId = parseInt(idParam, 10);

  if (isNaN(clusterId)) {
    return c.json({ error: "Invalid cluster ID" }, 400);
  }

  const cacheKey = generateCacheKey("analytics_timescale_cluster", { clusterId });
  const analysis = await getOrCompute(
    cacheKey,
    "analytics_timescale_cluster",
    () => analyzeClusterTimescales(clusterId)
  );

  if (!analysis) {
    return c.json({ error: "Cluster not found or no data available" }, 404);
  }

  return c.json({
    clusterId: analysis.clusterId,
    trends: {
      weekly: {
        direction: analysis.trends.weekly.direction,
        velocity: analysis.trends.weekly.velocity,
        confidence: analysis.trends.weekly.confidence,
        dataPoints: analysis.trends.weekly.dataPoints,
      },
      monthly: {
        direction: analysis.trends.monthly.direction,
        velocity: analysis.trends.monthly.velocity,
        confidence: analysis.trends.monthly.confidence,
        dataPoints: analysis.trends.monthly.dataPoints,
      },
      quarterly: {
        direction: analysis.trends.quarterly.direction,
        velocity: analysis.trends.quarterly.velocity,
        confidence: analysis.trends.quarterly.confidence,
        dataPoints: analysis.trends.quarterly.dataPoints,
      },
    },
    seasonalPattern: {
      detected: analysis.seasonalPattern.detected,
      peakMonths: analysis.seasonalPattern.peakMonths,
      troughMonths: analysis.seasonalPattern.troughMonths,
      amplitude: analysis.seasonalPattern.amplitude,
      confidence: analysis.seasonalPattern.confidence,
    },
    phaseTransition: {
      currentPhase: analysis.phaseTransition.currentPhase,
      previousPhase: analysis.phaseTransition.previousPhase,
      transitionDate: analysis.phaseTransition.transitionDate,
      stability: analysis.phaseTransition.stability,
      daysInCurrentPhase: analysis.phaseTransition.daysInCurrentPhase,
    },
    insight: analysis.insight,
  });
});
