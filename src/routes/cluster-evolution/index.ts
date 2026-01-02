/**
 * Cluster Evolution API Routes
 *
 * v7 時系列クラスタ追跡のAPIエンドポイント
 */

import { Hono } from "hono";
import {
  listSnapshots,
  getCurrentSnapshot,
  getSnapshotClusters,
  getSnapshotEvents,
  getClusterTimeline,
  listIdentities,
  setIdentityLabel,
  getIdentityTimeline,
} from "../../services/cluster/temporalClustering";

export const clusterEvolutionRoute = new Hono();

/**
 * GET /api/cluster-evolution/snapshots
 * スナップショット一覧を取得
 */
clusterEvolutionRoute.get("/snapshots", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  if (isNaN(limit) || limit < 1 || limit > 200) {
    return c.json({ error: "limit must be between 1 and 200" }, 400);
  }

  const snapshots = await listSnapshots(limit);

  return c.json({
    snapshots: snapshots.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      trigger: s.trigger,
      k: s.k,
      totalNotes: s.totalNotes,
      avgCohesion: s.avgCohesion,
      isCurrent: s.isCurrent,
      changeScore: s.changeScore,
      notesAdded: s.notesAdded,
      notesRemoved: s.notesRemoved,
      clusterCount: s.clusters.length,
    })),
    count: snapshots.length,
  });
});

/**
 * GET /api/cluster-evolution/snapshots/current
 * 現在のスナップショットを取得
 */
clusterEvolutionRoute.get("/snapshots/current", async (c) => {
  const snapshot = await getCurrentSnapshot();

  if (!snapshot) {
    return c.json({ error: "No snapshot available" }, 404);
  }

  return c.json({
    snapshot: {
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      trigger: snapshot.trigger,
      k: snapshot.k,
      totalNotes: snapshot.totalNotes,
      avgCohesion: snapshot.avgCohesion,
      changeScore: snapshot.changeScore,
      notesAdded: snapshot.notesAdded,
      notesRemoved: snapshot.notesRemoved,
    },
    clusters: snapshot.clusters.map((cl) => ({
      id: cl.id,
      localId: cl.localId,
      size: cl.size,
      sampleNoteId: cl.sampleNoteId,
      cohesion: cl.cohesion,
      identityId: cl.identityId,
    })),
  });
});

/**
 * GET /api/cluster-evolution/snapshots/:id/events
 * スナップショットのイベント一覧を取得
 */
clusterEvolutionRoute.get("/snapshots/:id/events", async (c) => {
  const idParam = c.req.param("id");
  const snapshotId = parseInt(idParam, 10);

  if (isNaN(snapshotId)) {
    return c.json({ error: "Invalid snapshot ID" }, 400);
  }

  const events = await getSnapshotEvents(snapshotId);

  return c.json({
    snapshotId,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      createdAt: e.createdAt,
      details: e.details,
    })),
    count: events.length,
  });
});

/**
 * GET /api/cluster-evolution/clusters/:id/timeline
 * 特定クラスタの系譜（タイムライン）を取得
 */
clusterEvolutionRoute.get("/clusters/:id/timeline", async (c) => {
  const idParam = c.req.param("id");
  const clusterId = parseInt(idParam, 10);
  const depthParam = c.req.query("depth");
  const maxDepth = depthParam ? parseInt(depthParam, 10) : 20;

  if (isNaN(clusterId)) {
    return c.json({ error: "Invalid cluster ID" }, 400);
  }

  if (isNaN(maxDepth) || maxDepth < 1 || maxDepth > 100) {
    return c.json({ error: "depth must be between 1 and 100" }, 400);
  }

  const timeline = await getClusterTimeline(clusterId, maxDepth);

  return c.json({
    clusterId,
    timeline: timeline.map((t) => ({
      snapshotId: t.snapshotId,
      snapshotCreatedAt: t.snapshotCreatedAt,
      cluster: {
        id: t.cluster.id,
        localId: t.cluster.localId,
        size: t.cluster.size,
        cohesion: t.cluster.cohesion,
        identityId: t.cluster.identityId,
      },
      similarity: t.similarity,
      confidenceLabel: t.confidenceLabel,
    })),
    depth: timeline.length,
  });
});

/**
 * GET /api/cluster-evolution/identities
 * クラスタアイデンティティ一覧を取得
 */
clusterEvolutionRoute.get("/identities", async (c) => {
  const activeOnly = c.req.query("activeOnly") === "true";
  const identities = await listIdentities(activeOnly);

  return c.json({
    identities: identities.map((i) => ({
      id: i.id,
      createdAt: i.createdAt,
      label: i.label,
      description: i.description,
      isActive: i.isActive,
      lastSeenSnapshotId: i.lastSeenSnapshotId,
    })),
    count: identities.length,
  });
});

/**
 * GET /api/cluster-evolution/identities/:id/timeline
 * 特定アイデンティティのタイムラインを取得
 */
clusterEvolutionRoute.get("/identities/:id/timeline", async (c) => {
  const idParam = c.req.param("id");
  const identityId = parseInt(idParam, 10);

  if (isNaN(identityId)) {
    return c.json({ error: "Invalid identity ID" }, 400);
  }

  const timeline = await getIdentityTimeline(identityId);

  return c.json({
    identityId,
    timeline,
    count: timeline.length,
  });
});

/**
 * PATCH /api/cluster-evolution/identities/:id
 * アイデンティティにラベルを設定
 */
clusterEvolutionRoute.patch("/identities/:id", async (c) => {
  const idParam = c.req.param("id");
  const identityId = parseInt(idParam, 10);

  if (isNaN(identityId)) {
    return c.json({ error: "Invalid identity ID" }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const { label, description } = body;

  if (!label || typeof label !== "string") {
    return c.json({ error: "label is required and must be a string" }, 400);
  }

  await setIdentityLabel(identityId, label, description);

  return c.json({
    success: true,
    identityId,
    label,
    description: description ?? null,
  });
});
