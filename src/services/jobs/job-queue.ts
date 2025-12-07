import { logger } from "../../utils/logger";
import { handleNoteAnalyzeJob } from "./job-worker";
import { handleClusterRebuildJob } from "./cluster-worker";

// ジョブタイプ
export type JobType = "NOTE_ANALYZE" | "CLUSTER_REBUILD";

// NOTE_ANALYZE ジョブのペイロード
export type NoteAnalyzePayload = {
  noteId: string;
  previousContent?: string | null;
  previousClusterId?: number | null; // v3: クラスタ遷移追跡用
  updatedAt: number; // ジョブ順序チェック用
};

// CLUSTER_REBUILD ジョブのペイロード
export type ClusterRebuildPayload = {
  k?: number; // クラスタ数（デフォルト: 8）
  regenerateEmbeddings?: boolean; // Embedding 未生成ノートを自動生成（デフォルト: true）
};

// ペイロードの型
type JobPayload = NoteAnalyzePayload | ClusterRebuildPayload;

// ジョブ定義
type Job = {
  type: JobType;
  payload: JobPayload;
  createdAt: number;
};

// メモリ内キュー
const queue: Job[] = [];
let isProcessing = false;

/**
 * ジョブをキューに追加
 */
export function enqueueJob(type: "NOTE_ANALYZE", payload: NoteAnalyzePayload): void;
export function enqueueJob(type: "CLUSTER_REBUILD", payload?: ClusterRebuildPayload): void;
export function enqueueJob(type: JobType, payload: JobPayload = {}): void {
  const job: Job = {
    type,
    payload,
    createdAt: Date.now(),
  };

  queue.push(job);
  logger.info({ type }, "[JobQueue] Job enqueued");

  // 非同期でキュー処理開始
  processQueue();
}

/**
 * キューを処理（シングルワーカー）
 */
const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;

    try {
      logger.info({ type: job.type }, "[JobQueue] Processing job");

      await handleJob(job);

      logger.info({ type: job.type }, "[JobQueue] Job completed");
    } catch (err) {
      logger.error({ err, type: job.type }, "[JobQueue] Job failed");
    }
  }

  isProcessing = false;
};

/**
 * ジョブをディスパッチ
 */
const handleJob = async (job: Job) => {
  switch (job.type) {
    case "NOTE_ANALYZE":
      return handleNoteAnalyzeJob(job.payload as NoteAnalyzePayload);
    case "CLUSTER_REBUILD":
      return handleClusterRebuildJob(job.payload as ClusterRebuildPayload);
    default:
      logger.warn({ type: job.type }, "[JobQueue] Unknown job type");
  }
};

/**
 * キューの状態を取得（デバッグ用）
 */
export const getQueueStatus = () => ({
  queueLength: queue.length,
  isProcessing,
});
