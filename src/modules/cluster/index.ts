/**
 * クラスターモジュール
 * 公開インターフェース
 */

// ルート
export { clustersRoute } from "./routes";
export { clusterDynamicsRoute } from "./routes-dynamics";
export { clusterEvolutionRoute } from "./routes-evolution";

// ディスパッチャー
export { clusterDispatcher } from "./dispatcher";
export { clusterDynamicsDispatcher } from "./dynamicsDispatcher";

// リポジトリ
export {
  findAllClusters,
  findClusterById,
  findNotesByClusterId,
  saveClusters,
  deleteAllClusters,
  updateAllNoteClusterIds,
  resetAllNoteClusterIds,
  deleteClusterHistoryByNoteIdRaw,
} from "./repository";

// サービス
export {
  captureClusterDynamics,
  getClusterDynamics,
  getClusterDynamicsTimeline,
  getClusterDynamicsSummary,
} from "./dynamicsService";

export {
  generateAllClusterLabels,
  regenerateClusterLabel,
} from "./labelService";

export {
  getClusterIdentity,
  getAllClusterIdentities,
  formatForGpt,
  GPT_IDENTITY_PROMPT,
} from "./identity";

export {
  getClusterQualityMetrics,
  getGlobalQualityMetrics,
} from "./metrics";

export {
  maybeCreateSnapshot,
  listSnapshots,
  getCurrentSnapshot,
  getSnapshotClusters,
  getSnapshotEvents,
  getClusterTimeline,
  listIdentities,
  setIdentityLabel,
  getIdentityTimeline,
} from "./temporalClustering";
