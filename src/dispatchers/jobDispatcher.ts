/**
 * Job Status ドメイン ディスパッチャー
 *
 * 非同期ジョブのステータス追跡・取得API
 */

import {
  getJob,
  getRecentJobs,
  getJobsByStatus,
  getJobsByType,
  getRunningJobs,
  getFailedJobs,
  getJobStats,
  cleanupOldJobs,
  type JobRecord,
} from "../repositories/jobStatusRepo";
import { JOB_STATUSES, JOB_TYPES } from "../db/schema";
import {
  validateId,
  validateLimit,
  validateEnum,
  validateNumberRange,
} from "../utils/validation";

export const jobDispatcher = {
  /**
   * job.get - 特定のジョブを取得
   * payload: { jobId: string }
   */
  async get(payload: unknown): Promise<JobRecord | null> {
    const p = payload as { jobId?: string } | undefined;
    const jobId = validateId(p?.jobId, "jobId");
    return await getJob(jobId);
  },

  /**
   * job.list - 最近のジョブ一覧を取得
   * payload: { limit?: number }
   */
  async list(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { limit?: number } | undefined;
    const limit = validateLimit(p?.limit, 20);
    return await getRecentJobs(limit);
  },

  /**
   * job.running - 実行中のジョブ一覧を取得
   */
  async running(): Promise<JobRecord[]> {
    return await getRunningJobs();
  },

  /**
   * job.failed - 失敗したジョブ一覧を取得
   * payload: { limit?: number }
   */
  async failed(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { limit?: number } | undefined;
    const limit = validateLimit(p?.limit, 20);
    return await getFailedJobs(limit);
  },

  /**
   * job.byStatus - ステータス別にジョブを取得
   * payload: { status: JobStatus, limit?: number }
   */
  async byStatus(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { status?: string; limit?: number } | undefined;
    const status = validateEnum(p?.status, "status", JOB_STATUSES);
    const limit = validateLimit(p?.limit, 20);
    return await getJobsByStatus(status, limit);
  },

  /**
   * job.byType - タイプ別にジョブを取得
   * payload: { type: JobType, limit?: number }
   */
  async byType(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { type?: string; limit?: number } | undefined;
    const type = validateEnum(p?.type, "type", JOB_TYPES);
    const limit = validateLimit(p?.limit, 20);
    return await getJobsByType(type, limit);
  },

  /**
   * job.stats - ジョブの統計情報を取得
   */
  async stats() {
    return await getJobStats();
  },

  /**
   * job.cleanup - 古いジョブを削除
   * payload: { retentionDays?: number }
   */
  async cleanup(payload: unknown): Promise<{ deletedCount: number }> {
    const p = payload as { retentionDays?: number } | undefined;
    const retentionDays = validateNumberRange(p?.retentionDays, "retentionDays", 1, 365, 7);
    const deletedCount = await cleanupOldJobs(retentionDays);
    return { deletedCount };
  },
};
