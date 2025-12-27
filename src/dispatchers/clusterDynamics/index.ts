/**
 * Cluster Dynamics ドメイン ディスパッチャー
 */

import * as clusterDynamicsService from "../../services/cluster/clusterDynamicsService";

export const clusterDynamicsDispatcher = {
  async summary(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    const date = p?.date ?? new Date().toISOString().split("T")[0];
    return clusterDynamicsService.getClusterDynamicsSummary(date);
  },

  async snapshot(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    const date = p?.date ?? new Date().toISOString().split("T")[0];
    return clusterDynamicsService.getClusterDynamics(date);
  },

  async timeline(payload: unknown) {
    const p = payload as { clusterId?: number; rangeDays?: number } | undefined;
    if (p?.clusterId === undefined) {
      throw new Error("clusterId is required");
    }
    const rangeDays = p.rangeDays ?? 30;
    return clusterDynamicsService.getClusterDynamicsTimeline(
      p.clusterId,
      rangeDays
    );
  },

  async capture(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    const date = p?.date ?? new Date().toISOString().split("T")[0];
    return clusterDynamicsService.captureClusterDynamics(date);
  },
};
