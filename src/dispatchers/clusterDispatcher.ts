/**
 * Cluster ドメイン ディスパッチャー
 */

import {
  findAllClusters,
  findClusterById,
  findNotesByClusterId,
} from "../repositories/clusterRepo";
import { getEmbedding } from "../repositories/embeddingRepo";
import { cosineSimilarity } from "../services/embeddingService";
import * as identityService from "../services/cluster/identity";
import { enqueueJob } from "../services/jobs/job-queue";
import {
  requireField,
  validateK,
  validateLimit,
  validateOptionalEnum,
} from "../utils/validation";

const MAP_FORMATS = ["full", "gpt"] as const;

export const clusterDispatcher = {
  async list() {
    const clusters = await findAllClusters();
    // GPT向けにcentroidを除外（大きな数値配列は解釈が難しい）
    return clusters.map(({ centroid, ...rest }) => rest);
  },

  async get(payload: unknown) {
    const p = payload as { id?: number } | undefined;
    const id = requireField(p?.id, "id");

    const cluster = await findClusterById(id);
    if (!cluster) {
      throw new Error(`Cluster ${id} not found`);
    }

    const notes = await findNotesByClusterId(id);

    return {
      ...cluster,
      notes,
    };
  },

  async map(payload: unknown) {
    const p = payload as { format?: "full" | "gpt" } | undefined;
    const format = validateOptionalEnum(p?.format, "format", MAP_FORMATS) ?? "full";

    const identities = await identityService.getAllClusterIdentities();

    if (format === "gpt") {
      return identities.map(identityService.formatForGpt);
    }

    return identities;
  },

  async identity(payload: unknown) {
    const p = payload as { id?: number } | undefined;
    const id = requireField(p?.id, "id");
    return identityService.getClusterIdentity(id);
  },

  async representatives(payload: unknown) {
    const p = payload as { id?: number; limit?: number } | undefined;
    const id = requireField(p?.id, "id");
    const limit = validateLimit(p?.limit, 5);

    // クラスタとそのセントロイドを取得
    const cluster = await findClusterById(id);
    if (!cluster) {
      throw new Error(`Cluster ${id} not found`);
    }

    const notes = await findNotesByClusterId(id);

    // セントロイドがない場合は従来通り先頭N件を返す
    if (!cluster.centroid) {
      return notes.slice(0, limit);
    }

    // 各ノートのembeddingを取得してセントロイドとの類似度を計算
    const notesWithSimilarity = await Promise.all(
      notes.map(async (note) => {
        const embedding = await getEmbedding(note.id);
        const similarity = embedding
          ? cosineSimilarity(cluster.centroid!, embedding)
          : 0;
        return { note, similarity };
      })
    );

    // 類似度の高い順（セントロイドに近い順）にソート
    notesWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    // 上位N件を返す（類似度スコア付き）
    return notesWithSimilarity.slice(0, limit).map(({ note, similarity }) => ({
      ...note,
      centroidSimilarity: similarity,
    }));
  },

  async rebuild(payload: unknown) {
    const p = payload as { k?: number; regenerateEmbeddings?: boolean } | undefined;
    const k = validateK(p?.k);
    const regenerateEmbeddings = p?.regenerateEmbeddings ?? false;

    await enqueueJob("CLUSTER_REBUILD", {
      k,
      regenerateEmbeddings,
    });

    return {
      message: "Cluster rebuild job enqueued",
      params: {
        k,
        regenerateEmbeddings,
      },
    };
  },
};
