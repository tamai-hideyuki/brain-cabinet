/**
 * PTM (Personal Thinking Model) ドメイン ディスパッチャー
 */

import * as ptmEngine from "../services/ptm/engine";
import * as ptmSnapshot from "../services/ptm/snapshot";
import * as ptmCore from "../services/ptm/core";
import * as ptmInfluence from "../services/ptm/influence";
import * as ptmDynamics from "../services/ptm/dynamics";

export const ptmDispatcher = {
  async today() {
    return ptmSnapshot.getLatestPtmSnapshot();
  },

  async history(payload: unknown) {
    const p = payload as { limit?: number } | undefined;
    const limit = p?.limit ?? 30;
    return ptmSnapshot.getPtmSnapshotHistory(limit);
  },

  async insight(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    const date = p?.date ?? new Date().toISOString().split("T")[0];
    return ptmSnapshot.generatePtmInsight(date);
  },

  async capture(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    const date = p?.date ?? new Date().toISOString().split("T")[0];
    return ptmSnapshot.capturePtmSnapshot(date);
  },

  async core() {
    return ptmCore.computeCoreMetrics();
  },

  async influence() {
    return ptmInfluence.computeInfluenceMetrics();
  },

  async dynamics(payload: unknown) {
    const p = payload as { rangeDays?: number } | undefined;
    const rangeDays = p?.rangeDays ?? 30;
    return ptmDynamics.computeDynamicsMetrics(rangeDays);
  },

  async stability(payload: unknown) {
    const p = payload as { date?: string } | undefined;
    const date = p?.date ?? new Date().toISOString().split("T")[0];
    return ptmDynamics.computeStabilityMetrics(date);
  },

  async summary() {
    return ptmEngine.generateMetaStateLite();
  },
};
