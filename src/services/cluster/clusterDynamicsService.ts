/**
 * Cluster Dynamics Service
 *
 * クラスタの日次動態を計算・保存するサービス
 *
 * - centroid: クラスタ重心（ノート埋め込みの平均）
 * - cohesion: 凝集度（ノートと重心のコサイン類似度平均）
 * - interactions: 他クラスタとの距離
 * - stability_score: 前日からの変化量
 */

import * as clusterRepo from "../../repositories/clusterRepo";
import {
  bufferToFloat32Array,
  float32ArrayToBuffer,
  cosineSimilarity,
  meanVector,
  normalizeVector,
  round4,
} from "../../utils/math";

export type ClusterDynamicsSnapshot = {
  clusterId: number;
  centroid: number[];
  cohesion: number;
  noteCount: number;
  interactions: Record<string, number>;
  stabilityScore: number | null;
};

/**
 * 日次クラスタ動態を計算・保存
 */
export async function captureClusterDynamics(
  date: string = new Date().toISOString().split("T")[0]
): Promise<ClusterDynamicsSnapshot[]> {
  // 既存のデータを削除（冪等性のため）
  await clusterRepo.deleteDynamicsByDate(date);

  // クラスタ一覧を取得
  const clusters = await clusterRepo.findAllClusterIdsFromClusters();

  // 全ノートの埋め込みとクラスタ情報を取得
  const embeddings = await clusterRepo.findAllNoteEmbeddings();

  // クラスタごとに埋め込みをグループ化
  const clusterEmbeddings = new Map<number, number[][]>();
  for (const e of embeddings) {
    if (e.cluster_id === null) continue;
    const vec = bufferToFloat32Array(e.embedding);
    if (vec.length === 0) continue;

    const list = clusterEmbeddings.get(e.cluster_id) ?? [];
    list.push(vec);
    clusterEmbeddings.set(e.cluster_id, list);
  }

  // 各クラスタの centroid を計算
  const clusterCentroids = new Map<number, number[]>();
  for (const [clusterId, vectors] of clusterEmbeddings) {
    const centroid = normalizeVector(meanVector(vectors));
    clusterCentroids.set(clusterId, centroid);
  }

  // 前日のデータを取得（stability_score 計算用）
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const previousData = await clusterRepo.findPreviousCentroids(yesterdayStr);

  const previousCentroids = new Map<number, number[]>();
  for (const p of previousData) {
    previousCentroids.set(p.cluster_id, bufferToFloat32Array(p.centroid));
  }

  // 各クラスタの動態を計算・保存
  const results: ClusterDynamicsSnapshot[] = [];

  for (const { id: clusterId } of clusters) {
    const vectors = clusterEmbeddings.get(clusterId) ?? [];
    const centroid = clusterCentroids.get(clusterId);

    if (!centroid || vectors.length === 0) {
      continue;
    }

    // 凝集度を計算
    let cohesionSum = 0;
    for (const vec of vectors) {
      cohesionSum += cosineSimilarity(vec, centroid);
    }
    const cohesion = round4(cohesionSum / vectors.length);

    // 他クラスタとの距離を計算
    const interactions: Record<string, number> = {};
    for (const [otherId, otherCentroid] of clusterCentroids) {
      if (otherId === clusterId) continue;
      const sim = cosineSimilarity(centroid, otherCentroid);
      interactions[String(otherId)] = round4(sim);
    }

    // stability_score を計算（前日の centroid との類似度）
    let stabilityScore: number | null = null;
    const prevCentroid = previousCentroids.get(clusterId);
    if (prevCentroid) {
      // 1 - similarity = 変化量（0 = 変化なし、1 = 完全に変化）
      const similarity = cosineSimilarity(centroid, prevCentroid);
      stabilityScore = round4(1 - similarity);
    }

    // データベースに保存
    const centroidBuffer = float32ArrayToBuffer(centroid);
    const interactionsJson = JSON.stringify(interactions);

    await clusterRepo.insertClusterDynamics({
      date,
      clusterId,
      centroidBuffer,
      cohesion,
      noteCount: vectors.length,
      interactionsJson,
      stabilityScore,
    });

    results.push({
      clusterId,
      centroid,
      cohesion,
      noteCount: vectors.length,
      interactions,
      stabilityScore,
    });
  }

  return results;
}

/**
 * 指定日のクラスタ動態を取得
 */
export async function getClusterDynamics(
  date: string
): Promise<ClusterDynamicsSnapshot[]> {
  const rows = await clusterRepo.findDynamicsByDate(date);

  return rows.map((r) => ({
    clusterId: r.cluster_id,
    centroid: bufferToFloat32Array(r.centroid),
    cohesion: r.cohesion,
    noteCount: r.note_count,
    interactions: r.interactions ? JSON.parse(r.interactions) : {},
    stabilityScore: r.stability_score,
  }));
}

/**
 * クラスタ動態の時系列を取得
 */
export async function getClusterDynamicsTimeline(
  clusterId: number,
  rangeDays: number = 30
): Promise<Array<{
  date: string;
  cohesion: number;
  noteCount: number;
  stabilityScore: number | null;
}>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startDateStr = startDate.toISOString().split("T")[0];

  const rows = await clusterRepo.findDynamicsTimeline(clusterId, startDateStr);

  return rows.map((r) => ({
    date: r.date,
    cohesion: r.cohesion,
    noteCount: r.note_count,
    stabilityScore: r.stability_score,
  }));
}

/**
 * クラスタ動態のサマリー統計を取得
 */
export async function getClusterDynamicsSummary(
  date: string = new Date().toISOString().split("T")[0]
): Promise<{
  date: string;
  clusterCount: number;
  totalNotes: number;
  avgCohesion: number;
  maxCohesion: { clusterId: number; cohesion: number };
  minCohesion: { clusterId: number; cohesion: number };
  mostUnstable: { clusterId: number; stabilityScore: number } | null;
}> {
  const dynamics = await getClusterDynamics(date);

  if (dynamics.length === 0) {
    return {
      date,
      clusterCount: 0,
      totalNotes: 0,
      avgCohesion: 0,
      maxCohesion: { clusterId: -1, cohesion: 0 },
      minCohesion: { clusterId: -1, cohesion: 0 },
      mostUnstable: null,
    };
  }

  const totalNotes = dynamics.reduce((sum, d) => sum + d.noteCount, 0);
  const avgCohesion = dynamics.reduce((sum, d) => sum + d.cohesion, 0) / dynamics.length;

  const sortedByCohesion = [...dynamics].sort((a, b) => b.cohesion - a.cohesion);
  const maxCohesion = sortedByCohesion[0];
  const minCohesion = sortedByCohesion[sortedByCohesion.length - 1];

  const withStability = dynamics.filter((d) => d.stabilityScore !== null);
  const mostUnstable = withStability.length > 0
    ? [...withStability].sort((a, b) => (b.stabilityScore ?? 0) - (a.stabilityScore ?? 0))[0]
    : null;

  return {
    date,
    clusterCount: dynamics.length,
    totalNotes,
    avgCohesion: round4(avgCohesion),
    maxCohesion: { clusterId: maxCohesion.clusterId, cohesion: maxCohesion.cohesion },
    minCohesion: { clusterId: minCohesion.clusterId, cohesion: minCohesion.cohesion },
    mostUnstable: mostUnstable
      ? { clusterId: mostUnstable.clusterId, stabilityScore: mostUnstable.stabilityScore! }
      : null,
  };
}
