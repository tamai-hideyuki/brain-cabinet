/**
 * Cluster Quality Metrics Service (v5.8)
 *
 * クラスター品質を測定する高度なメトリクス
 *
 * - Silhouette Coefficient: クラスターの分離度 (-1.0 〜 +1.0)
 * - Davies-Bouldin Index: クラスター間距離 (低いほど良い)
 * - Sub-cluster Detection: 1つのクラスター内の分岐検出
 * - Optimal K Recommendation: 最適なクラスター数の推定
 */

import { db } from "../../../db/client";
import { sql } from "drizzle-orm";
import {
  bufferToFloat32Array,
  cosineSimilarity,
  meanVector,
  normalizeVector,
  round4,
} from "../../../utils/math";

// ============================================================
// Types
// ============================================================

export type NoteEmbedding = {
  noteId: string;
  clusterId: number;
  embedding: number[];
};

export type ClusterInfo = {
  clusterId: number;
  centroid: number[];
  noteCount: number;
  embeddings: number[][];
};

export type SilhouetteResult = {
  noteId: string;
  clusterId: number;
  silhouetteScore: number;
  a: number; // 同クラスター内の平均距離
  b: number; // 最も近い他クラスターとの平均距離
};

export type ClusterSilhouette = {
  clusterId: number;
  avgSilhouette: number;
  noteCount: number;
  minSilhouette: number;
  maxSilhouette: number;
};

export type DaviesBouldinResult = {
  index: number;
  clusterScores: Array<{
    clusterId: number;
    worstPair: number;
    worstPartner: number;
  }>;
};

export type SubCluster = {
  centroid: number[];
  noteIds: string[];
  internalCohesion: number;
};

export type SubClusterResult = {
  clusterId: number;
  hasSubClusters: boolean;
  subClusters: SubCluster[];
  separationScore: number;
};

export type ClusterQualityMetrics = {
  clusterId: number;
  cohesion: number;
  silhouette: ClusterSilhouette;
  subClusterAnalysis: SubClusterResult;
  qualityGrade: "A" | "B" | "C" | "D" | "F";
  recommendations: string[];
};

export type GlobalQualityMetrics = {
  overallSilhouette: number;
  daviesBouldinIndex: number;
  clusterCount: number;
  totalNotes: number;
  optimalKEstimate: number;
  qualityAssessment: string;
  clusterMetrics: ClusterQualityMetrics[];
};

// ============================================================
// Data Fetching
// ============================================================

/**
 * 全ノートの埋め込みとクラスター情報を取得
 */
export async function getAllNoteEmbeddings(): Promise<NoteEmbedding[]> {
  const rows = await db.all<{
    note_id: string;
    embedding: Buffer;
    cluster_id: number | null;
  }>(sql`
    SELECT ne.note_id, ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
    WHERE n.cluster_id IS NOT NULL
  `);

  return rows.map((r) => ({
    noteId: r.note_id,
    clusterId: r.cluster_id!,
    embedding: bufferToFloat32Array(r.embedding),
  })).filter((e) => e.embedding.length > 0);
}

/**
 * 特定クラスターのノート埋め込みを取得
 */
export async function getClusterEmbeddings(
  clusterId: number
): Promise<NoteEmbedding[]> {
  const rows = await db.all<{
    note_id: string;
    embedding: Buffer;
    cluster_id: number;
  }>(sql`
    SELECT ne.note_id, ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
    WHERE n.cluster_id = ${clusterId}
  `);

  return rows.map((r) => ({
    noteId: r.note_id,
    clusterId: r.cluster_id,
    embedding: bufferToFloat32Array(r.embedding),
  })).filter((e) => e.embedding.length > 0);
}

/**
 * クラスター情報を構築
 */
export function buildClusterInfo(
  embeddings: NoteEmbedding[]
): Map<number, ClusterInfo> {
  const clusterMap = new Map<number, ClusterInfo>();

  for (const e of embeddings) {
    const existing = clusterMap.get(e.clusterId);
    if (existing) {
      existing.embeddings.push(e.embedding);
      existing.noteCount++;
    } else {
      clusterMap.set(e.clusterId, {
        clusterId: e.clusterId,
        centroid: [],
        noteCount: 1,
        embeddings: [e.embedding],
      });
    }
  }

  // 各クラスターのセントロイドを計算
  for (const [, info] of clusterMap) {
    info.centroid = normalizeVector(meanVector(info.embeddings));
  }

  return clusterMap;
}

// ============================================================
// Silhouette Coefficient
// ============================================================

/**
 * コサイン距離を計算 (1 - コサイン類似度)
 */
export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

/**
 * ノートのシルエット係数を計算
 *
 * s(i) = (b(i) - a(i)) / max(a(i), b(i))
 *
 * a(i): 同クラスター内の他ノートとの平均距離
 * b(i): 最も近い他クラスターのノートとの平均距離
 */
export function calculateNoteSilhouette(
  noteEmbedding: number[],
  noteClusterId: number,
  clusterInfo: Map<number, ClusterInfo>
): { silhouetteScore: number; a: number; b: number } {
  const ownCluster = clusterInfo.get(noteClusterId);

  if (!ownCluster || ownCluster.noteCount <= 1) {
    // 単一ノートのクラスターはシルエット計算不可
    return { silhouetteScore: 0, a: 0, b: 0 };
  }

  // a(i): 同クラスター内の平均距離
  let aSum = 0;
  let aCount = 0;
  for (const otherEmb of ownCluster.embeddings) {
    if (otherEmb === noteEmbedding) continue;
    aSum += cosineDistance(noteEmbedding, otherEmb);
    aCount++;
  }
  const a = aCount > 0 ? aSum / aCount : 0;

  // b(i): 最も近い他クラスターとの平均距離
  let minB = Infinity;
  for (const [clusterId, info] of clusterInfo) {
    if (clusterId === noteClusterId) continue;
    if (info.noteCount === 0) continue;

    let bSum = 0;
    for (const otherEmb of info.embeddings) {
      bSum += cosineDistance(noteEmbedding, otherEmb);
    }
    const avgB = bSum / info.embeddings.length;
    if (avgB < minB) {
      minB = avgB;
    }
  }
  const b = minB === Infinity ? 0 : minB;

  // シルエット係数を計算
  const maxAB = Math.max(a, b);
  const silhouetteScore = maxAB > 0 ? (b - a) / maxAB : 0;

  return { silhouetteScore: round4(silhouetteScore), a: round4(a), b: round4(b) };
}

/**
 * 全ノートのシルエット係数を計算
 */
export function calculateAllSilhouettes(
  embeddings: NoteEmbedding[],
  clusterInfo: Map<number, ClusterInfo>
): SilhouetteResult[] {
  return embeddings.map((e) => {
    const { silhouetteScore, a, b } = calculateNoteSilhouette(
      e.embedding,
      e.clusterId,
      clusterInfo
    );
    return {
      noteId: e.noteId,
      clusterId: e.clusterId,
      silhouetteScore,
      a,
      b,
    };
  });
}

/**
 * クラスター別のシルエット統計を計算
 */
export function calculateClusterSilhouettes(
  silhouettes: SilhouetteResult[]
): ClusterSilhouette[] {
  const clusterScores = new Map<number, number[]>();

  for (const s of silhouettes) {
    const existing = clusterScores.get(s.clusterId) ?? [];
    existing.push(s.silhouetteScore);
    clusterScores.set(s.clusterId, existing);
  }

  const results: ClusterSilhouette[] = [];
  for (const [clusterId, scores] of clusterScores) {
    if (scores.length === 0) continue;

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    results.push({
      clusterId,
      avgSilhouette: round4(avg),
      noteCount: scores.length,
      minSilhouette: round4(min),
      maxSilhouette: round4(max),
    });
  }

  return results.sort((a, b) => b.avgSilhouette - a.avgSilhouette);
}

/**
 * 全体のシルエット係数を計算
 */
export function calculateOverallSilhouette(
  silhouettes: SilhouetteResult[]
): number {
  if (silhouettes.length === 0) return 0;
  const sum = silhouettes.reduce((a, b) => a + b.silhouetteScore, 0);
  return round4(sum / silhouettes.length);
}

// ============================================================
// Davies-Bouldin Index
// ============================================================

/**
 * クラスター内の平均距離（散布度）を計算
 */
export function calculateClusterScatter(info: ClusterInfo): number {
  if (info.noteCount <= 1) return 0;

  let sum = 0;
  for (const emb of info.embeddings) {
    sum += cosineDistance(emb, info.centroid);
  }
  return sum / info.noteCount;
}

/**
 * Davies-Bouldin Index を計算
 *
 * DB = (1/n) * Σ max_{j≠i} (Si + Sj) / d(ci, cj)
 *
 * Si: クラスター i の散布度
 * d(ci, cj): クラスター間のセントロイド距離
 */
export function calculateDaviesBouldinIndex(
  clusterInfo: Map<number, ClusterInfo>
): DaviesBouldinResult {
  const clusterIds = Array.from(clusterInfo.keys());
  const n = clusterIds.length;

  if (n <= 1) {
    return { index: 0, clusterScores: [] };
  }

  // 各クラスターの散布度を計算
  const scatters = new Map<number, number>();
  for (const [id, info] of clusterInfo) {
    scatters.set(id, calculateClusterScatter(info));
  }

  const clusterScores: Array<{
    clusterId: number;
    worstPair: number;
    worstPartner: number;
  }> = [];

  let dbSum = 0;
  for (const i of clusterIds) {
    const iInfo = clusterInfo.get(i)!;
    const si = scatters.get(i)!;
    let maxRij = 0;
    let worstPartner = i;

    for (const j of clusterIds) {
      if (i === j) continue;
      const jInfo = clusterInfo.get(j)!;
      const sj = scatters.get(j)!;

      const dij = cosineDistance(iInfo.centroid, jInfo.centroid);
      if (dij === 0) continue;

      const rij = (si + sj) / dij;
      if (rij > maxRij) {
        maxRij = rij;
        worstPartner = j;
      }
    }

    dbSum += maxRij;
    clusterScores.push({
      clusterId: i,
      worstPair: round4(maxRij),
      worstPartner,
    });
  }

  return {
    index: round4(dbSum / n),
    clusterScores,
  };
}

// ============================================================
// Sub-cluster Detection
// ============================================================

/**
 * K-Means++ 初期化
 */
function kMeansPlusPlusInit(
  embeddings: number[][],
  k: number
): number[][] {
  if (embeddings.length <= k) {
    return embeddings.slice();
  }

  const centroids: number[][] = [];
  const distances = new Array(embeddings.length).fill(Infinity);

  // 最初のセントロイドをランダムに選択
  const firstIdx = Math.floor(Math.random() * embeddings.length);
  centroids.push(embeddings[firstIdx]);

  // 残りのセントロイドを距離に基づいて選択
  for (let c = 1; c < k; c++) {
    // 各点から最も近いセントロイドまでの距離を更新
    for (let i = 0; i < embeddings.length; i++) {
      const d = cosineDistance(embeddings[i], centroids[c - 1]);
      if (d < distances[i]) {
        distances[i] = d;
      }
    }

    // 距離の二乗に比例した確率で次のセントロイドを選択
    const distSquared = distances.map((d) => d * d);
    const totalDist = distSquared.reduce((a, b) => a + b, 0);

    if (totalDist === 0) break;

    let target = Math.random() * totalDist;
    let selectedIdx = 0;
    for (let i = 0; i < embeddings.length; i++) {
      target -= distSquared[i];
      if (target <= 0) {
        selectedIdx = i;
        break;
      }
    }
    centroids.push(embeddings[selectedIdx]);
  }

  return centroids;
}

/**
 * 簡易 K-Means クラスタリング
 */
export function simpleKMeans(
  embeddings: number[][],
  k: number,
  maxIterations: number = 20
): { centroids: number[][]; assignments: number[] } {
  if (embeddings.length === 0 || k <= 0) {
    return { centroids: [], assignments: [] };
  }

  if (embeddings.length <= k) {
    return {
      centroids: embeddings.slice(),
      assignments: embeddings.map((_, i) => i),
    };
  }

  // K-Means++ 初期化
  let centroids = kMeansPlusPlusInit(embeddings, k);
  let assignments = new Array(embeddings.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // 各点を最も近いセントロイドに割り当て
    const newAssignments = embeddings.map((emb) => {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = cosineDistance(emb, centroids[c]);
        if (d < minDist) {
          minDist = d;
          minIdx = c;
        }
      }
      return minIdx;
    });

    // 収束チェック
    let changed = false;
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] !== newAssignments[i]) {
        changed = true;
        break;
      }
    }

    assignments = newAssignments;

    if (!changed) break;

    // セントロイドを再計算
    const clusterPoints: number[][][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < embeddings.length; i++) {
      clusterPoints[assignments[i]].push(embeddings[i]);
    }

    centroids = clusterPoints.map((points) => {
      if (points.length === 0) return centroids[0];
      return normalizeVector(meanVector(points));
    });
  }

  return { centroids, assignments };
}

/**
 * サブクラスターを検出
 *
 * クラスター内の埋め込みに対して k=2 の K-Means を適用し、
 * 2つのグループに明確に分かれているかを評価
 */
export function detectSubClusters(
  embeddings: NoteEmbedding[],
  minSeparation: number = 0.3
): SubClusterResult {
  if (embeddings.length < 4) {
    return {
      clusterId: embeddings[0]?.clusterId ?? 0,
      hasSubClusters: false,
      subClusters: [],
      separationScore: 0,
    };
  }

  const clusterId = embeddings[0].clusterId;
  const vectors = embeddings.map((e) => e.embedding);

  // k=2 でクラスタリング
  const { centroids, assignments } = simpleKMeans(vectors, 2);

  // 各サブクラスターのノートを収集
  const subCluster0: string[] = [];
  const subCluster1: string[] = [];
  const vectors0: number[][] = [];
  const vectors1: number[][] = [];

  for (let i = 0; i < embeddings.length; i++) {
    if (assignments[i] === 0) {
      subCluster0.push(embeddings[i].noteId);
      vectors0.push(embeddings[i].embedding);
    } else {
      subCluster1.push(embeddings[i].noteId);
      vectors1.push(embeddings[i].embedding);
    }
  }

  // 両方に十分なノートがあるか確認
  if (subCluster0.length < 2 || subCluster1.length < 2) {
    return {
      clusterId,
      hasSubClusters: false,
      subClusters: [],
      separationScore: 0,
    };
  }

  // サブクラスター間の分離度を計算（セントロイド間距離）
  const separation = cosineDistance(centroids[0], centroids[1]);

  // 各サブクラスターの内部凝集度
  const cohesion0 = calculateInternalCohesion(vectors0, centroids[0]);
  const cohesion1 = calculateInternalCohesion(vectors1, centroids[1]);

  const hasSubClusters = separation >= minSeparation;

  return {
    clusterId,
    hasSubClusters,
    subClusters: hasSubClusters
      ? [
          {
            centroid: centroids[0],
            noteIds: subCluster0,
            internalCohesion: cohesion0,
          },
          {
            centroid: centroids[1],
            noteIds: subCluster1,
            internalCohesion: cohesion1,
          },
        ]
      : [],
    separationScore: round4(separation),
  };
}

/**
 * 内部凝集度を計算（セントロイドとの平均類似度）
 */
function calculateInternalCohesion(
  vectors: number[][],
  centroid: number[]
): number {
  if (vectors.length === 0) return 0;
  let sum = 0;
  for (const v of vectors) {
    sum += cosineSimilarity(v, centroid);
  }
  return round4(sum / vectors.length);
}

// ============================================================
// Quality Grade & Recommendations
// ============================================================

/**
 * クラスターの品質グレードを判定
 */
export function determineQualityGrade(
  silhouette: number,
  cohesion: number,
  hasSubClusters: boolean
): "A" | "B" | "C" | "D" | "F" {
  // シルエット係数ベースのグレーディング
  if (silhouette >= 0.7 && cohesion >= 0.8 && !hasSubClusters) return "A";
  if (silhouette >= 0.5 && cohesion >= 0.7) return "B";
  if (silhouette >= 0.25 && cohesion >= 0.5) return "C";
  if (silhouette >= 0.0) return "D";
  return "F";
}

/**
 * クラスターの改善推奨を生成
 */
export function generateRecommendations(
  silhouette: number,
  cohesion: number,
  subClusterResult: SubClusterResult,
  noteCount: number
): string[] {
  const recommendations: string[] = [];

  if (silhouette < 0) {
    recommendations.push(
      "ノートの再分類を検討してください。一部のノートが他クラスターに適している可能性があります。"
    );
  } else if (silhouette < 0.25) {
    recommendations.push(
      "クラスターの境界が曖昧です。関連クラスターとの統合を検討してください。"
    );
  }

  if (cohesion < 0.6) {
    recommendations.push(
      "クラスター内のノート間の関連性が低いです。より具体的なテーマで分割することを検討してください。"
    );
  }

  if (subClusterResult.hasSubClusters) {
    recommendations.push(
      `このクラスターには ${subClusterResult.subClusters.length} つのサブグループが検出されました。クラスター分割を検討してください。`
    );
  }

  if (noteCount < 3) {
    recommendations.push(
      "ノート数が少ないため、統計的信頼性が低いです。関連ノートの追加を検討してください。"
    );
  } else if (noteCount > 50) {
    recommendations.push(
      "ノート数が多いため、より細かいクラスター分割が有効かもしれません。"
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("クラスターの品質は良好です。");
  }

  return recommendations;
}

// ============================================================
// Optimal K Estimation
// ============================================================

/**
 * 最適なクラスター数を推定（エルボー法の簡易版）
 */
export function estimateOptimalK(
  embeddings: NoteEmbedding[],
  maxK: number = 10
): number {
  if (embeddings.length < 4) return Math.max(1, embeddings.length);

  const vectors = embeddings.map((e) => e.embedding);
  const actualMaxK = Math.min(maxK, Math.floor(embeddings.length / 2));

  const inertias: number[] = [];

  for (let k = 2; k <= actualMaxK; k++) {
    const { centroids, assignments } = simpleKMeans(vectors, k);

    // イナーシャ（クラスター内二乗和）を計算
    let inertia = 0;
    for (let i = 0; i < vectors.length; i++) {
      const d = cosineDistance(vectors[i], centroids[assignments[i]]);
      inertia += d * d;
    }
    inertias.push(inertia);
  }

  // エルボーポイントを検出（二次導関数の最大点）
  if (inertias.length < 3) return 2;

  let maxSecondDeriv = -Infinity;
  let optimalK = 2;

  for (let i = 1; i < inertias.length - 1; i++) {
    const secondDeriv =
      inertias[i - 1] - 2 * inertias[i] + inertias[i + 1];
    if (secondDeriv > maxSecondDeriv) {
      maxSecondDeriv = secondDeriv;
      optimalK = i + 2;
    }
  }

  return optimalK;
}

// ============================================================
// Main API Functions
// ============================================================

/**
 * 特定クラスターの品質メトリクスを取得
 */
export async function getClusterQualityMetrics(
  clusterId: number
): Promise<ClusterQualityMetrics | null> {
  const allEmbeddings = await getAllNoteEmbeddings();
  const clusterInfo = buildClusterInfo(allEmbeddings);

  const thisCluster = clusterInfo.get(clusterId);
  if (!thisCluster || thisCluster.noteCount === 0) {
    return null;
  }

  // シルエット係数を計算
  const clusterEmbeddings = allEmbeddings.filter(
    (e) => e.clusterId === clusterId
  );
  const allSilhouettes = calculateAllSilhouettes(allEmbeddings, clusterInfo);
  const clusterSilhouettes = allSilhouettes.filter(
    (s) => s.clusterId === clusterId
  );
  const silhouetteStats = calculateClusterSilhouettes(clusterSilhouettes)[0] ?? {
    clusterId,
    avgSilhouette: 0,
    noteCount: 0,
    minSilhouette: 0,
    maxSilhouette: 0,
  };

  // 凝集度を計算
  let cohesionSum = 0;
  for (const emb of thisCluster.embeddings) {
    cohesionSum += cosineSimilarity(emb, thisCluster.centroid);
  }
  const cohesion = round4(cohesionSum / thisCluster.noteCount);

  // サブクラスター検出
  const subClusterResult = detectSubClusters(clusterEmbeddings);

  // 品質グレードと推奨を生成
  const qualityGrade = determineQualityGrade(
    silhouetteStats.avgSilhouette,
    cohesion,
    subClusterResult.hasSubClusters
  );
  const recommendations = generateRecommendations(
    silhouetteStats.avgSilhouette,
    cohesion,
    subClusterResult,
    thisCluster.noteCount
  );

  return {
    clusterId,
    cohesion,
    silhouette: silhouetteStats,
    subClusterAnalysis: subClusterResult,
    qualityGrade,
    recommendations,
  };
}

/**
 * 全体の品質メトリクスを取得
 */
export async function getGlobalQualityMetrics(): Promise<GlobalQualityMetrics> {
  const allEmbeddings = await getAllNoteEmbeddings();

  if (allEmbeddings.length === 0) {
    return {
      overallSilhouette: 0,
      daviesBouldinIndex: 0,
      clusterCount: 0,
      totalNotes: 0,
      optimalKEstimate: 0,
      qualityAssessment: "データがありません。",
      clusterMetrics: [],
    };
  }

  const clusterInfo = buildClusterInfo(allEmbeddings);

  // 全ノートのシルエット係数
  const allSilhouettes = calculateAllSilhouettes(allEmbeddings, clusterInfo);
  const overallSilhouette = calculateOverallSilhouette(allSilhouettes);

  // Davies-Bouldin Index
  const dbResult = calculateDaviesBouldinIndex(clusterInfo);

  // 最適 K 推定
  const optimalKEstimate = estimateOptimalK(allEmbeddings);

  // 各クラスターのメトリクス
  const clusterMetrics: ClusterQualityMetrics[] = [];
  for (const [clusterId, info] of clusterInfo) {
    const clusterEmbeddings = allEmbeddings.filter(
      (e) => e.clusterId === clusterId
    );
    const clusterSilhouettes = allSilhouettes.filter(
      (s) => s.clusterId === clusterId
    );
    const silhouetteStats = calculateClusterSilhouettes(clusterSilhouettes)[0] ?? {
      clusterId,
      avgSilhouette: 0,
      noteCount: 0,
      minSilhouette: 0,
      maxSilhouette: 0,
    };

    // 凝集度
    let cohesionSum = 0;
    for (const emb of info.embeddings) {
      cohesionSum += cosineSimilarity(emb, info.centroid);
    }
    const cohesion = round4(cohesionSum / info.noteCount);

    // サブクラスター検出
    const subClusterResult = detectSubClusters(clusterEmbeddings);

    // 品質グレードと推奨
    const qualityGrade = determineQualityGrade(
      silhouetteStats.avgSilhouette,
      cohesion,
      subClusterResult.hasSubClusters
    );
    const recommendations = generateRecommendations(
      silhouetteStats.avgSilhouette,
      cohesion,
      subClusterResult,
      info.noteCount
    );

    clusterMetrics.push({
      clusterId,
      cohesion,
      silhouette: silhouetteStats,
      subClusterAnalysis: subClusterResult,
      qualityGrade,
      recommendations,
    });
  }

  // 品質評価を生成
  const qualityAssessment = generateQualityAssessment(
    overallSilhouette,
    dbResult.index,
    clusterInfo.size,
    optimalKEstimate
  );

  return {
    overallSilhouette,
    daviesBouldinIndex: dbResult.index,
    clusterCount: clusterInfo.size,
    totalNotes: allEmbeddings.length,
    optimalKEstimate,
    qualityAssessment,
    clusterMetrics: clusterMetrics.sort((a, b) => {
      const gradeOrder = { A: 0, B: 1, C: 2, D: 3, F: 4 };
      return gradeOrder[a.qualityGrade] - gradeOrder[b.qualityGrade];
    }),
  };
}

/**
 * 全体の品質評価を生成
 */
function generateQualityAssessment(
  silhouette: number,
  dbi: number,
  currentK: number,
  optimalK: number
): string {
  const parts: string[] = [];

  if (silhouette >= 0.5) {
    parts.push("クラスター分離は良好です。");
  } else if (silhouette >= 0.25) {
    parts.push("クラスター構造は中程度です。");
  } else if (silhouette >= 0) {
    parts.push("クラスターの境界が重複しています。");
  } else {
    parts.push("多くのノートが誤ったクラスターに属している可能性があります。");
  }

  if (dbi < 1.0) {
    parts.push("クラスター間の距離は適切です。");
  } else if (dbi < 2.0) {
    parts.push("一部のクラスターが近接しています。");
  } else {
    parts.push("クラスター間の分離が不十分です。統合を検討してください。");
  }

  if (Math.abs(currentK - optimalK) <= 1) {
    parts.push(`現在のクラスター数 (${currentK}) は適切です。`);
  } else if (currentK < optimalK) {
    parts.push(
      `クラスター数を ${optimalK} に増やすことで、より細かい分類が可能になるかもしれません。`
    );
  } else {
    parts.push(
      `クラスター数を ${optimalK} に減らすことで、より明確な分類になるかもしれません。`
    );
  }

  return parts.join(" ");
}
