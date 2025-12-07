import { Hono } from "hono";
import {
  captureClusterDynamics,
  getClusterDynamics,
  getClusterDynamicsTimeline,
  getClusterDynamicsSummary,
} from "../../services/cluster/clusterDynamicsService";

export const clusterDynamicsRoute = new Hono();

/**
 * GET /api/cluster-dynamics/summary
 * クラスタ動態のサマリー
 */
clusterDynamicsRoute.get("/summary", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().split("T")[0];
  const summary = await getClusterDynamicsSummary(date);

  return c.json(summary);
});

/**
 * GET /api/cluster-dynamics/snapshot
 * 指定日のスナップショット
 */
clusterDynamicsRoute.get("/snapshot", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().split("T")[0];
  const dynamics = await getClusterDynamics(date);

  // centroid はレスポンスに含めない（大きすぎる）
  const result = dynamics.map((d) => ({
    clusterId: d.clusterId,
    cohesion: d.cohesion,
    noteCount: d.noteCount,
    interactions: d.interactions,
    stabilityScore: d.stabilityScore,
  }));

  return c.json({
    date,
    clusters: result,
  });
});

/**
 * GET /api/cluster-dynamics/timeline/:clusterId
 * クラスタの時系列データ
 */
clusterDynamicsRoute.get("/timeline/:clusterId", async (c) => {
  const clusterId = parseInt(c.req.param("clusterId"), 10);
  const rangeParam = c.req.query("range") ?? "30d";

  const match = rangeParam.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 30;

  const timeline = await getClusterDynamicsTimeline(clusterId, rangeDays);

  return c.json({
    clusterId,
    range: `${rangeDays}d`,
    data: timeline,
  });
});

/**
 * POST /api/cluster-dynamics/capture
 * 日次スナップショットを手動でキャプチャ
 */
clusterDynamicsRoute.post("/capture", async (c) => {
  const date = new Date().toISOString().split("T")[0];
  const snapshots = await captureClusterDynamics(date);

  return c.json({
    date,
    captured: snapshots.length,
    clusters: snapshots.map((s) => ({
      clusterId: s.clusterId,
      cohesion: s.cohesion,
      noteCount: s.noteCount,
      stabilityScore: s.stabilityScore,
    })),
  });
});

/**
 * GET /api/cluster-dynamics/matrix
 * クラスタ間距離マトリクス
 */
clusterDynamicsRoute.get("/matrix", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().split("T")[0];
  const dynamics = await getClusterDynamics(date);

  // マトリクスを構築
  const clusterIds = dynamics.map((d) => d.clusterId).sort((a, b) => a - b);
  const matrix: Record<string, Record<string, number>> = {};

  for (const d of dynamics) {
    matrix[String(d.clusterId)] = { ...d.interactions };
    matrix[String(d.clusterId)][String(d.clusterId)] = 1.0; // 自己相関
  }

  return c.json({
    date,
    clusterIds,
    matrix,
  });
});

/**
 * GET /api/cluster-dynamics/insight
 * GPT向けインサイト
 */
clusterDynamicsRoute.get("/insight", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().split("T")[0];
  const summary = await getClusterDynamicsSummary(date);
  const dynamics = await getClusterDynamics(date);

  // インサイトを生成
  const insight = generateInsight(summary, dynamics);

  return c.json({
    date,
    summary: {
      clusterCount: summary.clusterCount,
      totalNotes: summary.totalNotes,
      avgCohesion: summary.avgCohesion,
    },
    highlights: {
      mostCohesive: summary.maxCohesion,
      leastCohesive: summary.minCohesion,
      mostUnstable: summary.mostUnstable,
    },
    insight,
  });
});

function generateInsight(
  summary: {
    clusterCount: number;
    totalNotes: number;
    avgCohesion: number;
    maxCohesion: { clusterId: number; cohesion: number };
    minCohesion: { clusterId: number; cohesion: number };
    mostUnstable: { clusterId: number; stabilityScore: number } | null;
  },
  dynamics: Array<{ clusterId: number; cohesion: number; noteCount: number; interactions: Record<string, number> }>
): string {
  if (summary.clusterCount === 0) {
    return "クラスタ動態データがありません。";
  }

  const insights: string[] = [];

  // 凝集度分析
  if (summary.avgCohesion > 0.8) {
    insights.push("全体的にクラスタの凝集度が高く、思考が明確に整理されています。");
  } else if (summary.avgCohesion < 0.7) {
    insights.push("クラスタの凝集度が低めです。ノートの分類を見直すと良いかもしれません。");
  }

  // 不安定なクラスタ
  if (summary.mostUnstable && summary.mostUnstable.stabilityScore > 0.1) {
    insights.push(`クラスタ ${summary.mostUnstable.clusterId} が最も変化しています。新しい知識が流入している可能性があります。`);
  }

  // クラスタ間の関係
  const closeRelations = dynamics.flatMap((d) =>
    Object.entries(d.interactions)
      .filter(([_, sim]) => sim > 0.8)
      .map(([otherId, sim]) => ({ from: d.clusterId, to: parseInt(otherId), sim }))
  );

  if (closeRelations.length > 0) {
    const uniqueRelations = closeRelations.filter((r, i) =>
      closeRelations.findIndex((x) => (x.from === r.to && x.to === r.from)) > i || closeRelations.findIndex((x) => (x.from === r.to && x.to === r.from)) === -1
    );
    if (uniqueRelations.length > 0) {
      const rel = uniqueRelations[0];
      insights.push(`クラスタ ${rel.from} と ${rel.to} が密接に関連しています（類似度 ${rel.sim.toFixed(2)}）。統合を検討しても良いかもしれません。`);
    }
  }

  return insights.length > 0 ? insights.join(" ") : "クラスタは安定して推移しています。";
}
