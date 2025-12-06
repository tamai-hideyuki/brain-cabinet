import { Hono } from "hono";
import {
  findAllClusters,
  findClusterById,
  findNotesByClusterId,
} from "../../repositories/clusterRepo";
import { enqueueJob } from "../../services/jobs/job-queue";
import { logger } from "../../utils/logger";

export const clustersRoute = new Hono();

/**
 * GET /api/clusters
 * 全クラスタ一覧を取得
 */
clustersRoute.get("/", async (c) => {
  const clusters = await findAllClusters();

  return c.json({
    clusters: clusters.map((cl) => ({
      id: cl.id,
      size: cl.size,
      sampleNoteId: cl.sampleNoteId,
      createdAt: cl.createdAt,
      updatedAt: cl.updatedAt,
    })),
    count: clusters.length,
  });
});

/**
 * GET /api/clusters/:id
 * 特定クラスタの詳細を取得（所属ノート一覧付き）
 */
clustersRoute.get("/:id", async (c) => {
  const idParam = c.req.param("id");
  const id = parseInt(idParam, 10);

  if (isNaN(id)) {
    return c.json({ error: "Invalid cluster ID" }, 400);
  }

  const cluster = await findClusterById(id);
  if (!cluster) {
    return c.json({ error: "Cluster not found" }, 404);
  }

  const notes = await findNotesByClusterId(id);

  return c.json({
    cluster: {
      id: cluster.id,
      size: cluster.size,
      sampleNoteId: cluster.sampleNoteId,
      createdAt: cluster.createdAt,
      updatedAt: cluster.updatedAt,
    },
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      tags: n.tags ? JSON.parse(n.tags) : [],
    })),
  });
});

/**
 * POST /api/clusters/rebuild
 * クラスタ再構築ジョブをキューに追加
 *
 * Body:
 *   - k?: number (2-50, デフォルト: 8)
 *   - regenerateEmbeddings?: boolean (デフォルト: true)
 *     true の場合、Embedding 未生成のノートを自動生成してからクラスタリング
 */
clustersRoute.post("/rebuild", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const k = body.k ? parseInt(body.k, 10) : undefined;
  const regenerateEmbeddings = body.regenerateEmbeddings !== false; // デフォルト true

  if (k !== undefined && (isNaN(k) || k < 2 || k > 50)) {
    return c.json({ error: "k must be a number between 2 and 50" }, 400);
  }

  enqueueJob("CLUSTER_REBUILD", { k, regenerateEmbeddings });

  logger.info(
    { k: k ?? "default", regenerateEmbeddings },
    "[ClustersRoute] Cluster rebuild job enqueued"
  );

  return c.json({
    message: "Cluster rebuild job enqueued",
    k: k ?? 8,
    regenerateEmbeddings,
    note: regenerateEmbeddings
      ? "Embedding 未生成ノートを自動生成してからクラスタリングします"
      : "既存の Embedding のみでクラスタリングします",
  });
});
