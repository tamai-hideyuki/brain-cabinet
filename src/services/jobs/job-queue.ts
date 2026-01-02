import { logger } from "../../utils/logger";
import { handleNoteAnalyzeJob } from "./job-worker";
import { handleClusterRebuildJob } from "./cluster-worker";
import { buildSearchIndex } from "../embeddingService";
import {
  createJob,
  startJob,
  completeJob,
  failJob,
} from "../../repositories/jobStatusRepo";
import type { JobType as SchemaJobType } from "../../db/schema";

// ジョブタイプ
export type JobType = "NOTE_ANALYZE" | "CLUSTER_REBUILD" | "INDEX_REBUILD";

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
  forceSnapshot?: boolean; // v7: 強制的にスナップショットを作成（デフォルト: false）
};

// INDEX_REBUILD ジョブのペイロード
export type IndexRebuildPayload = {
  // 現時点ではオプションなし
};

// ペイロードの型
type JobPayload = NoteAnalyzePayload | ClusterRebuildPayload | IndexRebuildPayload;

// ジョブ定義
type Job = {
  id: string; // DBのジョブID
  type: JobType;
  payload: JobPayload;
  createdAt: number;
};

// メモリ内キュー
const queue: Job[] = [];
let isProcessing = false;

/**
 * ジョブをキューに追加（ステータス追跡付き）
 */
export function enqueueJob(type: "NOTE_ANALYZE", payload: NoteAnalyzePayload): Promise<string>;
export function enqueueJob(type: "CLUSTER_REBUILD", payload?: ClusterRebuildPayload): Promise<string>;
export function enqueueJob(type: "INDEX_REBUILD", payload?: IndexRebuildPayload): Promise<string>;
export async function enqueueJob(type: JobType, payload: JobPayload = {}): Promise<string> {
  // DBにジョブを作成
  const jobId = await createJob(type as SchemaJobType, payload as Record<string, unknown>);

  const job: Job = {
    id: jobId,
    type,
    payload,
    createdAt: Date.now(),
  };

  queue.push(job);
  logger.info({ type, jobId }, "[JobQueue] Job enqueued");

  // 非同期でキュー処理開始
  processQueue();

  return jobId;
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
      // ジョブ開始をDBに記録
      await startJob(job.id);
      logger.info({ type: job.type, jobId: job.id }, "[JobQueue] Processing job");

      await handleJob(job);

      // ジョブ成功をDBに記録
      await completeJob(job.id, { completedAt: Date.now() });
      logger.info({ type: job.type, jobId: job.id }, "[JobQueue] Job completed");
    } catch (err) {
      // ジョブ失敗をDBに記録
      const errorMessage = err instanceof Error ? err.message : String(err);
      await failJob(job.id, errorMessage);
      logger.error({ err, type: job.type, jobId: job.id }, "[JobQueue] Job failed");
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
    case "INDEX_REBUILD":
      return buildSearchIndex();
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
