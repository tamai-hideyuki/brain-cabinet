import { logger } from "../../utils/logger";
import { handleNoteAnalyzeJob } from "./job-worker";

// ジョブタイプ
export type JobType = "NOTE_ANALYZE";

// NOTE_ANALYZE ジョブのペイロード
export type NoteAnalyzePayload = {
  noteId: string;
  previousContent?: string | null;
  updatedAt: number; // ジョブ順序チェック用
};

// ジョブ定義
type Job = {
  type: JobType;
  payload: NoteAnalyzePayload;
  createdAt: number;
};

// メモリ内キュー
const queue: Job[] = [];
let isProcessing = false;

/**
 * ジョブをキューに追加
 */
export const enqueueJob = (type: JobType, payload: NoteAnalyzePayload) => {
  const job: Job = {
    type,
    payload,
    createdAt: Date.now(),
  };

  queue.push(job);
  logger.debug({ type, noteId: payload.noteId }, "[JobQueue] Job enqueued");

  // 非同期でキュー処理開始
  processQueue();
};

/**
 * キューを処理（シングルワーカー）
 */
const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;

    try {
      logger.debug(
        { type: job.type, noteId: job.payload.noteId },
        "[JobQueue] Processing job"
      );

      await handleJob(job);

      logger.debug(
        { type: job.type, noteId: job.payload.noteId },
        "[JobQueue] Job completed"
      );
    } catch (err) {
      logger.error(
        { err, type: job.type, noteId: job.payload.noteId },
        "[JobQueue] Job failed"
      );
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
      return handleNoteAnalyzeJob(job.payload);
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
