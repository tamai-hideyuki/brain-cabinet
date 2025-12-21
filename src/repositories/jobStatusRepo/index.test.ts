import { describe, it, expect, vi, beforeEach } from "vitest";

// モックを設定
vi.mock("../../db/client", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    }),
    run: vi.fn().mockResolvedValue(undefined),
    all: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-12345"),
}));

import {
  createJob,
  startJob,
  updateJobProgress,
  completeJob,
  failJob,
  getJob,
  getRecentJobs,
  getJobsByStatus,
  getJobsByType,
  getRunningJobs,
  getFailedJobs,
  getJobStats,
  cleanupOldJobs,
  createJobStatusTable,
  checkJobStatusTableExists,
} from "./index";
import { db } from "../../db/client";

describe("jobStatusRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createJob", () => {
    it("ジョブを作成してIDを返す", async () => {
      const jobId = await createJob("NOTE_ANALYZE", { noteId: "note-1" });

      expect(jobId).toBe("test-uuid-12345");
      expect(db.insert).toHaveBeenCalled();
    });

    it("ペイロードなしでも作成できる", async () => {
      const jobId = await createJob("CLUSTER_REBUILD");

      expect(jobId).toBe("test-uuid-12345");
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("startJob", () => {
    it("ジョブのステータスをrunningに更新する", async () => {
      await startJob("job-123");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("updateJobProgress", () => {
    it("進捗を更新する", async () => {
      await updateJobProgress("job-123", 50, "Processing...");

      expect(db.update).toHaveBeenCalled();
    });

    it("進捗は0-100の範囲に収まる", async () => {
      await updateJobProgress("job-123", 150);
      await updateJobProgress("job-123", -10);

      expect(db.update).toHaveBeenCalledTimes(2);
    });
  });

  describe("completeJob", () => {
    it("ジョブを成功完了としてマークする", async () => {
      await completeJob("job-123", { result: "success" });

      expect(db.update).toHaveBeenCalled();
    });

    it("結果なしでも完了できる", async () => {
      await completeJob("job-123");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("failJob", () => {
    it("ジョブを失敗としてマークする", async () => {
      await failJob("job-123", "Something went wrong");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("getJob", () => {
    it("存在しないジョブはnullを返す", async () => {
      const result = await getJob("nonexistent");

      expect(result).toBeNull();
    });

    it("存在するジョブを返す", async () => {
      const mockJob = {
        id: "job-123",
        type: "NOTE_ANALYZE",
        status: "completed",
        payload: '{"noteId":"note-1"}',
        result: '{"success":true}',
        error: null,
        progress: 100,
        progressMessage: "Done",
        createdAt: 1000,
        startedAt: 1001,
        completedAt: 1002,
      };

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockJob]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      const result = await getJob("job-123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("job-123");
      expect(result?.type).toBe("NOTE_ANALYZE");
      expect(result?.status).toBe("completed");
      expect(result?.payload).toEqual({ noteId: "note-1" });
      expect(result?.result).toEqual({ success: true });
    });
  });

  describe("getRecentJobs", () => {
    it("最近のジョブ一覧を取得する", async () => {
      await getRecentJobs(10);

      expect(db.select).toHaveBeenCalled();
    });

    it("デフォルトで20件取得する", async () => {
      await getRecentJobs();

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getJobsByStatus", () => {
    it("ステータス別にジョブを取得する", async () => {
      await getJobsByStatus("failed", 10);

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getJobsByType", () => {
    it("タイプ別にジョブを取得する", async () => {
      await getJobsByType("NOTE_ANALYZE", 10);

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getRunningJobs", () => {
    it("実行中のジョブを取得する", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

      await getRunningJobs();

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getFailedJobs", () => {
    it("失敗したジョブを取得する", async () => {
      await getFailedJobs(10);

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getJobStats", () => {
    it("ジョブ統計を計算する", async () => {
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([
          { id: "1", type: "NOTE_ANALYZE", status: "completed" },
          { id: "2", type: "NOTE_ANALYZE", status: "failed" },
          { id: "3", type: "CLUSTER_REBUILD", status: "running" },
          { id: "4", type: "NOTE_ANALYZE", status: "pending" },
        ]),
      } as unknown as ReturnType<typeof db.select>);

      const stats = await getJobStats();

      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.running).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.byType["NOTE_ANALYZE"]).toBe(3);
      expect(stats.byType["CLUSTER_REBUILD"]).toBe(1);
    });
  });

  describe("cleanupOldJobs", () => {
    it("古いジョブを削除する", async () => {
      vi.mocked(db.delete).mockReturnValueOnce({
        where: vi.fn().mockResolvedValue({ rowsAffected: 5 }),
      } as unknown as ReturnType<typeof db.delete>);

      const deleted = await cleanupOldJobs(7);

      expect(deleted).toBe(5);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("createJobStatusTable", () => {
    it("テーブルを作成する", async () => {
      await createJobStatusTable();

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("checkJobStatusTableExists", () => {
    it("テーブルが存在する場合trueを返す", async () => {
      vi.mocked(db.all).mockResolvedValueOnce([{ name: "job_statuses" }]);

      const exists = await checkJobStatusTableExists();

      expect(exists).toBe(true);
    });

    it("テーブルが存在しない場合falseを返す", async () => {
      vi.mocked(db.all).mockResolvedValueOnce([]);

      const exists = await checkJobStatusTableExists();

      expect(exists).toBe(false);
    });

    it("エラー時はfalseを返す", async () => {
      vi.mocked(db.all).mockRejectedValueOnce(new Error("DB error"));

      const exists = await checkJobStatusTableExists();

      expect(exists).toBe(false);
    });
  });
});
