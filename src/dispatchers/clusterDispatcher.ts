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
import {
  requireField,
  validateK,
  validateLimit,
  validateOptionalEnum,
} from "../utils/validation";

const MAP_FORMATS = ["full", "gpt"] as const;

export const clusterDispatcher = {
  async list() {
    return findAllClusters();
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

    const notes = await findNotesByClusterId(id);

    // 代表ノート（中心に近い順）を返す
    // 現状はシンプルに最初のN件を返す
    return notes.slice(0, limit);
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
