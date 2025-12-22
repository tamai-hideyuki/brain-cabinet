import { Hono } from "hono";
import {
  findAllClusters,
  findClusterById,
  findNotesByClusterId,
} from "../../repositories/clusterRepo";
import { enqueueJob } from "../../services/jobs/job-queue";
import { logger } from "../../utils/logger";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import {
  getClusterIdentity,
  getAllClusterIdentities,
  formatForGpt,
  GPT_IDENTITY_PROMPT,
} from "../../services/cluster/identity";

// ヘルパー関数
function bufferToFloat32Array(buffer: Buffer | ArrayBuffer | Uint8Array): number[] {
  let uint8: Uint8Array;

  if (buffer instanceof ArrayBuffer) {
    uint8 = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    uint8 = buffer;
  } else if (Buffer.isBuffer(buffer)) {
    uint8 = new Uint8Array(buffer);
  } else {
    return [];
  }

  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
  const float32 = new Float32Array(arrayBuffer);
  return Array.from(float32);
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

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
 * GET /api/clusters/map
 * 全クラスタの identity 一覧を取得
 */
clustersRoute.get("/map", async (c) => {
  const identities = await getAllClusterIdentities();

  return c.json({
    clusters: identities,
    count: identities.length,
  });
});

/**
 * GET /api/clusters/map/gpt
 * GPT 人格化エンジン用のフォーマットで全クラスタを取得
 */
clustersRoute.get("/map/gpt", async (c) => {
  const identities = await getAllClusterIdentities();

  return c.json({
    prompt: GPT_IDENTITY_PROMPT,
    clusters: identities.map(formatForGpt),
    count: identities.length,
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
/**
 * GET /api/clusters/:id/representatives
 * クラスタの代表ノート（重心に最も近いノート Top N）を取得
 *
 * Query:
 *   - top?: number (デフォルト: 5)
 */
clustersRoute.get("/:id/identity", async (c) => {
  const idParam = c.req.param("id");
  const clusterId = parseInt(idParam, 10);

  if (isNaN(clusterId)) {
    return c.json({ error: "Invalid cluster ID" }, 400);
  }

  const identity = await getClusterIdentity(clusterId);

  if (!identity) {
    return c.json({ error: "Cluster not found or no dynamics data available" }, 404);
  }

  return c.json(identity);
});

clustersRoute.get("/:id/representatives", async (c) => {
  const idParam = c.req.param("id");
  const clusterId = parseInt(idParam, 10);
  const topParam = c.req.query("top");
  const top = topParam ? parseInt(topParam, 10) : 5;

  if (isNaN(clusterId)) {
    return c.json({ error: "Invalid cluster ID" }, 400);
  }

  if (isNaN(top) || top < 1 || top > 20) {
    return c.json({ error: "top must be between 1 and 20" }, 400);
  }

  // 最新の cluster_dynamics から centroid を取得
  const dynamicsRows = await db.all<{
    centroid: Buffer;
    date: string;
  }>(sql`
    SELECT centroid, date FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
    ORDER BY date DESC
    LIMIT 1
  `);

  if (dynamicsRows.length === 0 || !dynamicsRows[0].centroid) {
    return c.json({ error: "No centroid available for this cluster" }, 404);
  }

  const centroidBuffer = dynamicsRows[0].centroid;
  const centroid = bufferToFloat32Array(centroidBuffer);

  if (centroid.length === 0) {
    return c.json({ error: "Invalid centroid data" }, 500);
  }

  // クラスタ所属ノートの embedding を取得
  const noteRows = await db.all<{
    note_id: string;
    title: string;
    embedding: Buffer;
    updated_at: number;
    category: string | null;
  }>(sql`
    SELECT n.id as note_id, n.title, n.category, n.updated_at, ne.embedding
    FROM notes n
    JOIN note_embeddings ne ON n.id = ne.note_id
    WHERE n.cluster_id = ${clusterId}
  `);

  if (noteRows.length === 0) {
    return c.json({
      clusterId,
      top,
      notes: [],
    });
  }

  // 各ノートの cosine 類似度を計算
  const scoredNotes = noteRows
    .map((row) => {
      const embedding = bufferToFloat32Array(row.embedding);
      if (embedding.length === 0) return null;

      const cosineScore = cosineSimilarity(centroid, embedding);

      return {
        id: row.note_id,
        title: row.title,
        category: row.category,
        cosine: Math.round(cosineScore * 10000) / 10000,
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null)
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, top);

  return c.json({
    clusterId,
    date: dynamicsRows[0].date,
    top,
    notes: scoredNotes,
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
