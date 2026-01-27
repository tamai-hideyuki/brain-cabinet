/**
 * PTM Influence Aggregator
 *
 * note_influence_edges からノート・クラスタの影響力を集計
 */

import * as ptmRepo from "../../repositories/ptmRepo";
import type {
  InfluenceMetrics,
  InfluencerSummary,
  InfluencedSummary,
  ClusterInfluence,
} from "./types";

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Influence Metrics を計算
 */
export async function computeInfluenceMetrics(): Promise<InfluenceMetrics> {
  // 基本統計
  const basicStats = await ptmRepo.findInfluenceBasicStats();

  const totalEdges = basicStats?.total_edges ?? 0;
  const avgWeight = basicStats?.avg_weight ?? 0;

  if (totalEdges === 0) {
    return {
      totalEdges: 0,
      avgWeight: 0,
      topInfluencers: [],
      topInfluenced: [],
      clusterInfluence: [],
      primaryHubNote: null,
    };
  }

  // Top Influencers（影響を与えているノート）
  const influencerRows = await ptmRepo.findTopInfluencers(5);

  const topInfluencers: InfluencerSummary[] = influencerRows.map((r) => ({
    noteId: r.source_note_id,
    outWeight: round4(r.out_weight),
    edgeCount: r.edge_count,
  }));

  // Top Influenced（影響を受けているノート）
  const influencedRows = await ptmRepo.findTopInfluenced(5);

  const topInfluenced: InfluencedSummary[] = influencedRows.map((r) => ({
    noteId: r.target_note_id,
    inWeight: round4(r.in_weight),
    edgeCount: r.edge_count,
  }));

  // クラスタ別影響力
  // source_note → そのクラスタが「与えた」影響
  // target_note → そのクラスタが「受けた」影響
  const clusterGivenRows = await ptmRepo.findClusterGivenInfluence();
  const clusterReceivedRows = await ptmRepo.findClusterReceivedInfluence();

  // 集約
  const clusterMap = new Map<number, { given: number; received: number }>();

  for (const r of clusterGivenRows) {
    const existing = clusterMap.get(r.cluster_id) ?? { given: 0, received: 0 };
    existing.given = round4(r.given);
    clusterMap.set(r.cluster_id, existing);
  }

  for (const r of clusterReceivedRows) {
    const existing = clusterMap.get(r.cluster_id) ?? { given: 0, received: 0 };
    existing.received = round4(r.received);
    clusterMap.set(r.cluster_id, existing);
  }

  const clusterInfluence: ClusterInfluence[] = Array.from(clusterMap.entries())
    .map(([clusterId, { given, received }]) => ({
      clusterId,
      given,
      received,
    }))
    .sort((a, b) => (b.given + b.received) - (a.given + a.received));

  // Primary Hub Note（最も影響を与えているノート）
  const primaryHubNote = topInfluencers.length > 0 ? topInfluencers[0].noteId : null;

  return {
    totalEdges,
    avgWeight: round4(avgWeight),
    topInfluencers,
    topInfluenced,
    clusterInfluence,
    primaryHubNote,
  };
}

/**
 * クラスタ間の影響フローを計算
 */
export async function computeClusterInfluenceFlow(): Promise<
  Array<{ source: number; target: number; weight: number }>
> {
  const rows = await ptmRepo.findClusterInfluenceFlow();

  return rows.map((r) => ({
    source: r.source_cluster,
    target: r.target_cluster,
    weight: round4(r.total_weight),
  }));
}
