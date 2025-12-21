import { db } from "../../db/client";
import { jobStatuses, type JobStatus, type JobType } from "../../db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * ジョブ作成
 */
export const createJob = async (
  type: JobType,
  payload?: Record<string, unknown>
): Promise<string> => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(jobStatuses).values({
    id,
    type,
    status: "pending",
    payload: payload ? JSON.stringify(payload) : null,
    createdAt: now,
  });

  return id;
};

/**
 * ジョブ開始
 */
export const startJob = async (jobId: string): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(jobStatuses)
    .set({
      status: "running",
      startedAt: now,
    })
    .where(eq(jobStatuses.id, jobId));
};

/**
 * ジョブ進捗更新
 */
export const updateJobProgress = async (
  jobId: string,
  progress: number,
  message?: string
): Promise<void> => {
  await db
    .update(jobStatuses)
    .set({
      progress: Math.min(100, Math.max(0, progress)),
      progressMessage: message ?? null,
    })
    .where(eq(jobStatuses.id, jobId));
};

/**
 * ジョブ成功完了
 */
export const completeJob = async (
  jobId: string,
  result?: Record<string, unknown>
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(jobStatuses)
    .set({
      status: "completed",
      progress: 100,
      result: result ? JSON.stringify(result) : null,
      completedAt: now,
    })
    .where(eq(jobStatuses.id, jobId));
};

/**
 * ジョブ失敗
 */
export const failJob = async (
  jobId: string,
  error: string
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(jobStatuses)
    .set({
      status: "failed",
      error,
      completedAt: now,
    })
    .where(eq(jobStatuses.id, jobId));
};

/**
 * ジョブ取得（ID指定）
 */
export const getJob = async (jobId: string) => {
  const result = await db
    .select()
    .from(jobStatuses)
    .where(eq(jobStatuses.id, jobId))
    .limit(1);

  if (result.length === 0) return null;

  return parseJobRow(result[0]);
};

/**
 * 最近のジョブ一覧を取得
 */
export const getRecentJobs = async (limit = 20) => {
  const result = await db
    .select()
    .from(jobStatuses)
    .orderBy(desc(jobStatuses.createdAt))
    .limit(limit);

  return result.map(parseJobRow);
};

/**
 * ステータス別ジョブ一覧を取得
 */
export const getJobsByStatus = async (status: JobStatus, limit = 20) => {
  const result = await db
    .select()
    .from(jobStatuses)
    .where(eq(jobStatuses.status, status))
    .orderBy(desc(jobStatuses.createdAt))
    .limit(limit);

  return result.map(parseJobRow);
};

/**
 * タイプ別ジョブ一覧を取得
 */
export const getJobsByType = async (type: JobType, limit = 20) => {
  const result = await db
    .select()
    .from(jobStatuses)
    .where(eq(jobStatuses.type, type))
    .orderBy(desc(jobStatuses.createdAt))
    .limit(limit);

  return result.map(parseJobRow);
};

/**
 * 実行中のジョブを取得
 */
export const getRunningJobs = async () => {
  const result = await db
    .select()
    .from(jobStatuses)
    .where(eq(jobStatuses.status, "running"))
    .orderBy(desc(jobStatuses.startedAt));

  return result.map(parseJobRow);
};

/**
 * 失敗したジョブを取得
 */
export const getFailedJobs = async (limit = 20) => {
  const result = await db
    .select()
    .from(jobStatuses)
    .where(eq(jobStatuses.status, "failed"))
    .orderBy(desc(jobStatuses.completedAt))
    .limit(limit);

  return result.map(parseJobRow);
};

/**
 * 古いジョブを削除（保持日数指定）
 */
export const cleanupOldJobs = async (retentionDays = 7): Promise<number> => {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 24 * 60 * 60;

  const result = await db
    .delete(jobStatuses)
    .where(
      and(
        inArray(jobStatuses.status, ["completed", "failed"]),
        sql`${jobStatuses.completedAt} < ${cutoff}`
      )
    );

  return result.rowsAffected;
};

/**
 * ジョブの統計情報を取得
 */
export const getJobStats = async () => {
  const allJobs = await db.select().from(jobStatuses);

  const stats = {
    total: allJobs.length,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    byType: {} as Record<string, number>,
  };

  for (const job of allJobs) {
    stats[job.status as keyof typeof stats]++;
    stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;
  }

  return stats;
};

// ヘルパー: DBの行をパースして型安全なオブジェクトに変換
const parseJobRow = (row: typeof jobStatuses.$inferSelect) => ({
  id: row.id,
  type: row.type as JobType,
  status: row.status as JobStatus,
  payload: row.payload ? JSON.parse(row.payload) : null,
  result: row.result ? JSON.parse(row.result) : null,
  error: row.error,
  progress: row.progress,
  progressMessage: row.progressMessage,
  createdAt: row.createdAt,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
});

export type JobRecord = ReturnType<typeof parseJobRow>;

/**
 * ジョブステータステーブルを作成
 */
export const createJobStatusTable = async (): Promise<void> => {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS job_statuses (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT,
      result TEXT,
      error TEXT,
      progress INTEGER,
      progress_message TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      started_at INTEGER,
      completed_at INTEGER
    )
  `);
};

/**
 * ジョブステータステーブルが存在するか確認
 */
export const checkJobStatusTableExists = async (): Promise<boolean> => {
  try {
    const result = await db.all<{ name: string }>(sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='job_statuses'
    `);
    return result.length > 0;
  } catch {
    return false;
  }
};
