import { kmeans } from "ml-kmeans";
import { getAllEmbeddings } from "../../repositories/embeddingRepo";
import {
  deleteAllClusters,
  saveClusters,
  updateAllNoteClusterIds,
  resetAllNoteClusterIds,
} from "../../repositories/clusterRepo";
import { cosineSimilarity } from "../embeddingService";
import { logger } from "../../utils/logger";
import type { ClusterRebuildPayload } from "./job-queue";

// デフォルトクラスタ数
const DEFAULT_K = 8;

// 最小ノート数（これ以下だとクラスタリングしない）
const MIN_NOTES_FOR_CLUSTERING = 3;

/**
 * CLUSTER_REBUILD ジョブのメイン処理
 *
 * 1. 全ノートの embedding を取得
 * 2. K-Means でクラスタリング
 * 3. 各ノートに cluster_id を割り当て
 * 4. clusters テーブルを更新
 */
export const handleClusterRebuildJob = async (payload: ClusterRebuildPayload) => {
  const k = payload.k ?? DEFAULT_K;

  logger.info({ k }, "[ClusterWorker] Starting cluster rebuild");

  // 1. 全 embedding を取得
  const allEmbeddings = await getAllEmbeddings();

  if (allEmbeddings.length < MIN_NOTES_FOR_CLUSTERING) {
    logger.warn(
      { count: allEmbeddings.length, minRequired: MIN_NOTES_FOR_CLUSTERING },
      "[ClusterWorker] Not enough notes for clustering"
    );
    return;
  }

  // クラスタ数がノート数より大きい場合は調整
  const actualK = Math.min(k, allEmbeddings.length);

  logger.info(
    { noteCount: allEmbeddings.length, k: actualK },
    "[ClusterWorker] Running K-Means"
  );

  // 2. K-Means 実行
  const data = allEmbeddings.map((e) => e.embedding);
  const result = kmeans(data, actualK, {
    initialization: "kmeans++",
    maxIterations: 100,
  });

  // 3. ノートごとのクラスタ割り当てを作成
  const assignments: Array<{ noteId: string; clusterId: number }> = [];
  for (let i = 0; i < allEmbeddings.length; i++) {
    assignments.push({
      noteId: allEmbeddings[i].noteId,
      clusterId: result.clusters[i],
    });
  }

  // 4. クラスタ情報を作成
  const clusterInfos: Array<{
    id: number;
    centroid: number[];
    size: number;
    sampleNoteId: string | null;
  }> = [];

  for (let clusterId = 0; clusterId < actualK; clusterId++) {
    const centroid = result.centroids[clusterId];
    const memberIndices = result.clusters
      .map((c, i) => (c === clusterId ? i : -1))
      .filter((i) => i >= 0);

    const size = memberIndices.length;

    // 代表ノート（centroid に最も近いノート）を見つける
    let sampleNoteId: string | null = null;
    let maxSimilarity = -1;

    for (const idx of memberIndices) {
      const embedding = allEmbeddings[idx].embedding;
      const similarity = cosineSimilarity(centroid, embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        sampleNoteId = allEmbeddings[idx].noteId;
      }
    }

    clusterInfos.push({
      id: clusterId,
      centroid,
      size,
      sampleNoteId,
    });
  }

  // 5. DB 更新
  logger.info("[ClusterWorker] Updating database");

  // 既存クラスタを削除
  await deleteAllClusters();

  // 全ノートの cluster_id をリセット
  await resetAllNoteClusterIds();

  // 新しいクラスタを保存
  await saveClusters(clusterInfos);

  // ノートの cluster_id を更新
  await updateAllNoteClusterIds(assignments);

  logger.info(
    {
      k: actualK,
      noteCount: allEmbeddings.length,
      clusterSizes: clusterInfos.map((c) => c.size),
    },
    "[ClusterWorker] Cluster rebuild completed"
  );
};
