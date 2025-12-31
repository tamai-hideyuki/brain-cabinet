/**
 * Workflow Status Repository のテスト
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInitialProgress,
  startWorkflow,
  updateWorkflowProgress,
  setClusterJobId,
  completeWorkflow,
  failWorkflow,
  getWorkflowStatus,
  getLatestWorkflowStatus,
  getRunningWorkflow,
  getWorkflowStatusResult,
  createWorkflowStatusTable,
  checkWorkflowStatusTableExists,
  parseWorkflowRow,
} from "./index";

// モック
vi.mock("../../db/client", () => {
  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
  });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockRun = vi.fn().mockResolvedValue(undefined);
  const mockAll = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue({ lastInsertRowid: BigInt(1) }),
  });
  const mockUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return {
    db: {
      select: mockSelect,
      run: mockRun,
      all: mockAll,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

vi.mock("../jobStatusRepo", () => ({
  getJob: vi.fn().mockResolvedValue(null),
}));

import { db } from "../../db/client";
import { getJob } from "../jobStatusRepo";

describe("workflowStatusRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createInitialProgress", () => {
    it("初期進捗状態を作成する", () => {
      const progress = createInitialProgress();

      expect(progress.inferences.status).toBe("pending");
      expect(progress.embeddings.status).toBe("pending");
      expect(progress.clusters.status).toBe("pending");
      expect(progress.fts.status).toBe("pending");
      expect(progress.driftEvents.status).toBe("pending");
      expect(progress.influenceGraph.status).toBe("pending");
      expect(progress.clusterDynamics.status).toBe("pending");
      expect(progress.ptmSnapshot.status).toBe("pending");
    });

    it("全てのステップがpending状態", () => {
      const progress = createInitialProgress();
      const allPending = Object.values(progress).every(
        (step) => step.status === "pending"
      );
      expect(allPending).toBe(true);
    });
  });

  describe("parseWorkflowRow", () => {
    it("DBの行をWorkflowStatusRecordに変換する", () => {
      const row = {
        id: 1,
        workflow: "full_rebuild",
        status: "running",
        progress: JSON.stringify(createInitialProgress()),
        clusterJobId: "job-123",
        startedAt: 1700000000,
        completedAt: null,
        error: null,
      };

      const result = parseWorkflowRow(row as any);

      expect(result.id).toBe(1);
      expect(result.workflow).toBe("full_rebuild");
      expect(result.status).toBe("running");
      expect(result.progress).not.toBeNull();
      expect(result.clusterJobId).toBe("job-123");
    });

    it("progressがnullの場合はnullを返す", () => {
      const row = {
        id: 1,
        workflow: "incremental",
        status: "completed",
        progress: null,
        clusterJobId: null,
        startedAt: 1700000000,
        completedAt: 1700000100,
        error: null,
      };

      const result = parseWorkflowRow(row as any);

      expect(result.progress).toBeNull();
    });
  });

  describe("startWorkflow", () => {
    it("ワークフローを開始しIDを返す", async () => {
      const mockValues = vi.fn().mockResolvedValue({ lastInsertRowid: BigInt(42) });
      vi.mocked(db.insert).mockReturnValue({ values: mockValues } as any);

      const result = await startWorkflow("reconstruct");

      expect(result).toBe(42);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("updateWorkflowProgress", () => {
    it("ステップ進捗を更新する", async () => {
      // getWorkflowStatusのモック
      const mockProgress = createInitialProgress();
      const mockRow = {
        id: 1,
        workflow: "full_rebuild",
        status: "running",
        progress: JSON.stringify(mockProgress),
        clusterJobId: null,
        startedAt: 1700000000,
        completedAt: null,
        error: null,
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await updateWorkflowProgress(1, "inferences", { status: "completed" });

      expect(db.update).toHaveBeenCalled();
    });

    it("ワークフローが存在しない場合は何もしない", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await updateWorkflowProgress(999, "inferences", { status: "completed" });

      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("setClusterJobId", () => {
    it("クラスタジョブIDを設定する", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await setClusterJobId(1, "job-123");

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ clusterJobId: "job-123" });
    });
  });

  describe("completeWorkflow", () => {
    it("ワークフローを完了にする", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await completeWorkflow(1);

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );
    });
  });

  describe("failWorkflow", () => {
    it("ワークフローを失敗にする", async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

      await failWorkflow(1, "Something went wrong");

      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          error: "Something went wrong",
        })
      );
    });
  });

  describe("getWorkflowStatus", () => {
    it("IDでワークフローステータスを取得する", async () => {
      const mockRow = {
        id: 1,
        workflow: "full_rebuild",
        status: "running",
        progress: JSON.stringify(createInitialProgress()),
        clusterJobId: null,
        startedAt: 1700000000,
        completedAt: null,
        error: null,
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getWorkflowStatus(1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(1);
      expect(result?.workflow).toBe("full_rebuild");
    });

    it("存在しない場合はnullを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getWorkflowStatus(999);

      expect(result).toBeNull();
    });
  });

  describe("getLatestWorkflowStatus", () => {
    it("最新のワークフローステータスを取得する", async () => {
      const mockRow = {
        id: 5,
        workflow: "incremental",
        status: "completed",
        progress: null,
        clusterJobId: null,
        startedAt: 1700000000,
        completedAt: 1700000100,
        error: null,
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getLatestWorkflowStatus();

      expect(result).not.toBeNull();
      expect(result?.id).toBe(5);
    });

    it("ワークフローがない場合はnullを返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getLatestWorkflowStatus();

      expect(result).toBeNull();
    });
  });

  describe("getRunningWorkflow", () => {
    it("実行中のワークフローを取得する", async () => {
      const mockRow = {
        id: 3,
        workflow: "full_rebuild",
        status: "running",
        progress: JSON.stringify(createInitialProgress()),
        clusterJobId: null,
        startedAt: 1700000000,
        completedAt: null,
        error: null,
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getRunningWorkflow();

      expect(result).not.toBeNull();
      expect(result?.status).toBe("running");
    });
  });

  describe("getWorkflowStatusResult", () => {
    it("ワークフローがない場合はidle状態を返す", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getWorkflowStatusResult();

      expect(result.ok).toBe(true);
      expect(result.status).toBe("idle");
      expect(result.workflow).toBeNull();
      expect(result.progress).toBeNull();
    });

    it("完了したワークフローの経過時間を計算する", async () => {
      const mockRow = {
        id: 1,
        workflow: "full_rebuild",
        status: "completed",
        progress: null,
        clusterJobId: null,
        startedAt: 1700000000,
        completedAt: 1700000100, // 100秒後
        error: null,
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      const result = await getWorkflowStatusResult();

      expect(result.elapsed).toBe(100);
    });

    it("実行中のワークフローでクラスタジョブの進捗を統合する", async () => {
      const mockRow = {
        id: 1,
        workflow: "full_rebuild",
        status: "running",
        progress: JSON.stringify(createInitialProgress()),
        clusterJobId: "job-123",
        startedAt: 1700000000,
        completedAt: null,
        error: null,
      };
      const mockLimit = vi.fn().mockResolvedValue([mockRow]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      vi.mocked(getJob).mockResolvedValue({
        id: "job-123",
        status: "running",
        progress: 50,
        progressMessage: "Processing...",
      } as any);

      const result = await getWorkflowStatusResult();

      expect(result.progress?.clusters.progress).toBe(50);
      expect(result.progress?.clusters.message).toBe("Processing...");
    });
  });

  describe("createWorkflowStatusTable", () => {
    it("ワークフローステータステーブルを作成する", async () => {
      await createWorkflowStatusTable();

      expect(db.run).toHaveBeenCalled();
    });
  });

  describe("checkWorkflowStatusTableExists", () => {
    it("テーブルが存在する場合trueを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([{ name: "workflow_status" }]);

      const result = await checkWorkflowStatusTableExists();

      expect(result).toBe(true);
    });

    it("テーブルが存在しない場合falseを返す", async () => {
      vi.mocked(db.all).mockResolvedValue([]);

      const result = await checkWorkflowStatusTableExists();

      expect(result).toBe(false);
    });

    it("エラーが発生した場合falseを返す", async () => {
      vi.mocked(db.all).mockRejectedValue(new Error("DB error"));

      const result = await checkWorkflowStatusTableExists();

      expect(result).toBe(false);
    });
  });
});
