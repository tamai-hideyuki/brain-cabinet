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
import type { JobStatus, JobType } from "../db/schema";

export const jobDispatcher = {
  /**
   * job.get - 特定のジョブを取得
   * payload: { jobId: string }
   */
  async get(payload: unknown): Promise<JobRecord | null> {
    const p = payload as { jobId?: string } | undefined;
    if (!p?.jobId) {
      throw new Error("jobId is required");
    }
    return await getJob(p.jobId);
  },

  /**
   * job.list - 最近のジョブ一覧を取得
   * payload: { limit?: number }
   */
  async list(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { limit?: number } | undefined;
    const limit = p?.limit ?? 20;
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
    const limit = p?.limit ?? 20;
    return await getFailedJobs(limit);
  },

  /**
   * job.byStatus - ステータス別にジョブを取得
   * payload: { status: JobStatus, limit?: number }
   */
  async byStatus(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { status?: JobStatus; limit?: number } | undefined;
    if (!p?.status) {
      throw new Error("status is required");
    }
    const limit = p.limit ?? 20;
    return await getJobsByStatus(p.status, limit);
  },

  /**
   * job.byType - タイプ別にジョブを取得
   * payload: { type: JobType, limit?: number }
   */
  async byType(payload: unknown): Promise<JobRecord[]> {
    const p = payload as { type?: JobType; limit?: number } | undefined;
    if (!p?.type) {
      throw new Error("type is required");
    }
    const limit = p.limit ?? 20;
    return await getJobsByType(p.type, limit);
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
    const retentionDays = p?.retentionDays ?? 7;
    const deletedCount = await cleanupOldJobs(retentionDays);
    return { deletedCount };
  },
};
