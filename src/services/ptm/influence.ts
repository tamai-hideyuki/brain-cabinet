/**
 * PTM Influence Aggregator
 *
 * note_influence_edges からノート・クラスタの影響力を集計
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
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
  const basicStats = await db.all<{
    total_edges: number;
    avg_weight: number;
  }>(sql`
    SELECT
      COUNT(*) as total_edges,
      AVG(weight) as avg_weight
    FROM note_influence_edges
  `);

  const totalEdges = basicStats[0]?.total_edges ?? 0;
  const avgWeight = basicStats[0]?.avg_weight ?? 0;

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
  const influencerRows = await db.all<{
    source_note_id: string;
    out_weight: number;
    edge_count: number;
  }>(sql`
    SELECT
      source_note_id,
      SUM(weight) as out_weight,
      COUNT(*) as edge_count
    FROM note_influence_edges
    GROUP BY source_note_id
    ORDER BY out_weight DESC
    LIMIT 5
  `);

  const topInfluencers: InfluencerSummary[] = influencerRows.map((r) => ({
    noteId: r.source_note_id,
    outWeight: round4(r.out_weight),
    edgeCount: r.edge_count,
  }));

  // Top Influenced（影響を受けているノート）
  const influencedRows = await db.all<{
    target_note_id: string;
    in_weight: number;
    edge_count: number;
  }>(sql`
    SELECT
      target_note_id,
      SUM(weight) as in_weight,
      COUNT(*) as edge_count
    FROM note_influence_edges
    GROUP BY target_note_id
    ORDER BY in_weight DESC
    LIMIT 5
  `);

  const topInfluenced: InfluencedSummary[] = influencedRows.map((r) => ({
    noteId: r.target_note_id,
    inWeight: round4(r.in_weight),
    edgeCount: r.edge_count,
  }));

  // クラスタ別影響力
  // source_note → そのクラスタが「与えた」影響
  // target_note → そのクラスタが「受けた」影響
  const clusterGivenRows = await db.all<{
    cluster_id: number;
    given: number;
  }>(sql`
    SELECT
      n.cluster_id,
      SUM(e.weight) as given
    FROM note_influence_edges e
    JOIN notes n ON e.source_note_id = n.id
    WHERE n.cluster_id IS NOT NULL
    GROUP BY n.cluster_id
  `);

  const clusterReceivedRows = await db.all<{
    cluster_id: number;
    received: number;
  }>(sql`
    SELECT
      n.cluster_id,
      SUM(e.weight) as received
    FROM note_influence_edges e
    JOIN notes n ON e.target_note_id = n.id
    WHERE n.cluster_id IS NOT NULL
    GROUP BY n.cluster_id
  `);

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
  const rows = await db.all<{
    source_cluster: number;
    target_cluster: number;
    total_weight: number;
  }>(sql`
    SELECT
      src.cluster_id as source_cluster,
      tgt.cluster_id as target_cluster,
      SUM(e.weight) as total_weight
    FROM note_influence_edges e
    JOIN notes src ON e.source_note_id = src.id
    JOIN notes tgt ON e.target_note_id = tgt.id
    WHERE src.cluster_id IS NOT NULL
      AND tgt.cluster_id IS NOT NULL
    GROUP BY src.cluster_id, tgt.cluster_id
    ORDER BY total_weight DESC
  `);

  return rows.map((r) => ({
    source: r.source_cluster,
    target: r.target_cluster,
    weight: round4(r.total_weight),
  }));
}
