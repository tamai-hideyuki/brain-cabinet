/**
 * PTM Core Engine
 *
 * Personal Thinking Model の基礎メトリクスを計算
 *
 * - グローバル重心・クラスタ重心
 * - クラスタ構成比
 * - Drift との統合
 */

import * as ptmRepo from "../../repositories/ptmRepo";
import type {
  CoreMetrics,
  ClusterWeight,
  ClusterCentroid,
} from "./types";

/**
 * Buffer を Float32Array に変換
 */
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

/**
 * ベクトルの平均を計算
 */
function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

/**
 * ベクトルを L2 正規化
 */
function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Core Metrics を計算
 */
export async function computeCoreMetrics(): Promise<CoreMetrics> {
  // 全ノートの埋め込みとクラスタ情報を取得
  const embeddings = await ptmRepo.findAllNoteEmbeddingsWithCluster();

  if (embeddings.length === 0) {
    return {
      totalNotes: 0,
      clusterCount: 0,
      globalCentroid: null,
      clusterWeights: [],
      dominantCluster: null,
    };
  }

  // 全ベクトルを取得
  const allVectors: number[][] = [];
  const clusterVectors = new Map<number, number[][]>();

  for (const e of embeddings) {
    const vec = bufferToFloat32Array(e.embedding);
    if (vec.length === 0) continue;

    allVectors.push(vec);

    if (e.cluster_id !== null) {
      const list = clusterVectors.get(e.cluster_id) ?? [];
      list.push(vec);
      clusterVectors.set(e.cluster_id, list);
    }
  }

  // グローバル重心
  const globalCentroid = normalizeVector(meanVector(allVectors));

  // クラスタ構成比
  const clusterWeights: ClusterWeight[] = [];
  for (const [clusterId, vectors] of clusterVectors) {
    clusterWeights.push({
      clusterId,
      noteCount: vectors.length,
      weight: round4(vectors.length / allVectors.length),
    });
  }

  // 降順ソート
  clusterWeights.sort((a, b) => b.weight - a.weight);

  // 支配的クラスタ
  const dominantCluster = clusterWeights.length > 0 ? clusterWeights[0].clusterId : null;

  return {
    totalNotes: allVectors.length,
    clusterCount: clusterVectors.size,
    globalCentroid,
    clusterWeights,
    dominantCluster,
  };
}

/**
 * クラスタ重心を計算
 */
export async function computeClusterCentroids(): Promise<ClusterCentroid[]> {
  const embeddings = await ptmRepo.findAllNoteEmbeddingsWithCluster();

  const clusterVectors = new Map<number, number[][]>();

  for (const e of embeddings) {
    if (e.cluster_id === null) continue;
    const vec = bufferToFloat32Array(e.embedding);
    if (vec.length === 0) continue;

    const list = clusterVectors.get(e.cluster_id) ?? [];
    list.push(vec);
    clusterVectors.set(e.cluster_id, list);
  }

  const centroids: ClusterCentroid[] = [];
  for (const [clusterId, vectors] of clusterVectors) {
    const centroid = normalizeVector(meanVector(vectors));
    centroids.push({
      clusterId,
      centroid,
      noteCount: vectors.length,
    });
  }

  return centroids.sort((a, b) => a.clusterId - b.clusterId);
}
