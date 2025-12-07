/**
 * Cluster ドメイン ディスパッチャー
 */

import {
  findAllClusters,
  findClusterById,
  findNotesByClusterId,
} from "../repositories/clusterRepo";
import * as identityService from "../services/cluster/identityService";
import { enqueueJob } from "../services/jobs/job-queue";

export const clusterDispatcher = {
  async list() {
    return findAllClusters();
  },

  async get(payload: unknown) {
    const p = payload as { id?: number } | undefined;
    if (p?.id === undefined) {
      throw new Error("id is required");
    }

    const cluster = await findClusterById(p.id);
    if (!cluster) {
      throw new Error(`Cluster ${p.id} not found`);
    }

    const notes = await findNotesByClusterId(p.id);

    return {
      ...cluster,
      notes,
    };
  },

  async map(payload: unknown) {
    const p = payload as { format?: "full" | "gpt" } | undefined;
    const format = p?.format ?? "full";

    const identities = await identityService.getAllClusterIdentities();

    if (format === "gpt") {
      return identities.map(identityService.formatForGpt);
    }

    return identities;
  },

  async identity(payload: unknown) {
    const p = payload as { id?: number } | undefined;
    if (p?.id === undefined) {
      throw new Error("id is required");
    }
    return identityService.getClusterIdentity(p.id);
  },

  async representatives(payload: unknown) {
    const p = payload as { id?: number; limit?: number } | undefined;
    if (p?.id === undefined) {
      throw new Error("id is required");
    }

    const limit = p.limit ?? 5;
    const notes = await findNotesByClusterId(p.id);

    // 代表ノート（中心に近い順）を返す
    // 現状はシンプルに最初のN件を返す
    return notes.slice(0, limit);
  },

  async rebuild(payload: unknown) {
    const p = payload as { k?: number; regenerateEmbeddings?: boolean } | undefined;

    enqueueJob("CLUSTER_REBUILD", {
      k: p?.k,
      regenerateEmbeddings: p?.regenerateEmbeddings,
    });

    return {
      message: "Cluster rebuild job enqueued",
      params: {
        k: p?.k ?? 8,
        regenerateEmbeddings: p?.regenerateEmbeddings ?? false,
      },
    };
  },
};
