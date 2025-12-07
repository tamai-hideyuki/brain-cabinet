import { Hono } from "hono";
import {
  generatePtmSnapshot,
  capturePtmSnapshot,
  getLatestPtmSnapshot,
  getPtmSnapshotHistory,
  generatePtmInsight,
} from "../../services/ptm/snapshot";
import { computeCoreMetrics } from "../../services/ptm/core";
import { computeInfluenceMetrics } from "../../services/ptm/influence";
import { computeDynamicsMetrics, computeStabilityMetrics } from "../../services/ptm/dynamics";

export const ptmRoute = new Hono();

/**
 * GET /api/ptm/today
 * 今日の PTM Snapshot
 */
ptmRoute.get("/today", async (c) => {
  const today = new Date().toISOString().split("T")[0];
  const snapshot = await generatePtmSnapshot(today);

  return c.json(snapshot);
});

/**
 * GET /api/ptm/history
 * 過去の PTM Snapshot 履歴
 */
ptmRoute.get("/history", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 7;

  const snapshots = await getPtmSnapshotHistory(limit);

  return c.json({
    range: `${limit}d`,
    count: snapshots.length,
    snapshots,
  });
});

/**
 * GET /api/ptm/insight
 * GPT向けインサイト（推奨エンドポイント）
 */
ptmRoute.get("/insight", async (c) => {
  const today = new Date().toISOString().split("T")[0];
  const insight = await generatePtmInsight(today);

  return c.json(insight);
});

/**
 * POST /api/ptm/capture
 * 手動でスナップショットをキャプチャ
 */
ptmRoute.post("/capture", async (c) => {
  const today = new Date().toISOString().split("T")[0];
  const snapshot = await capturePtmSnapshot(today);

  return c.json({
    message: "Snapshot captured successfully",
    date: today,
    snapshot,
  });
});

/**
 * GET /api/ptm/core
 * Core Metrics のみ
 */
ptmRoute.get("/core", async (c) => {
  const core = await computeCoreMetrics();

  return c.json({
    ...core,
    // globalCentroid は大きいので省略
    globalCentroid: core.globalCentroid ? `[${core.globalCentroid.length} dims]` : null,
  });
});

/**
 * GET /api/ptm/influence
 * Influence Metrics のみ
 */
ptmRoute.get("/influence", async (c) => {
  const influence = await computeInfluenceMetrics();

  return c.json(influence);
});

/**
 * GET /api/ptm/dynamics
 * Dynamics Metrics のみ
 */
ptmRoute.get("/dynamics", async (c) => {
  const rangeParam = c.req.query("range");
  const match = rangeParam?.match(/^(\d+)d$/);
  const rangeDays = match ? parseInt(match[1], 10) : 7;

  const dynamics = await computeDynamicsMetrics(rangeDays);

  return c.json({
    range: `${rangeDays}d`,
    ...dynamics,
  });
});

/**
 * GET /api/ptm/stability
 * Stability Metrics のみ
 */
ptmRoute.get("/stability", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().split("T")[0];
  const stability = await computeStabilityMetrics(date);

  return c.json({
    date,
    ...stability,
  });
});

/**
 * GET /api/ptm/summary
 * 超軽量サマリー（GPT用最小API）
 */
ptmRoute.get("/summary", async (c) => {
  const today = new Date().toISOString().split("T")[0];
  const [core, dynamics] = await Promise.all([
    computeCoreMetrics(),
    computeDynamicsMetrics(7),
  ]);

  return c.json({
    date: today,
    totalNotes: core.totalNotes,
    clusterCount: core.clusterCount,
    dominantCluster: core.dominantCluster,
    mode: dynamics.mode,
    season: dynamics.season,
    topDriftCluster: dynamics.topDriftCluster,
  });
});
