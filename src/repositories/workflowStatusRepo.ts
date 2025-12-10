/**
 * Workflow Status リポジトリ
 *
 * ワークフロー実行状態の追跡・管理
 */

import { db } from "../db/client";
import {
  workflowStatus,
  type WorkflowType,
  type WorkflowStatus,
  type WorkflowStepStatus,
} from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getJob } from "./jobStatusRepo";

// ============================================
// 型定義
// ============================================

export type StepProgress = {
  status: WorkflowStepStatus;
  progress?: number; // 0-100（主にクラスタリング用）
  message?: string;
  details?: Record<string, unknown>;
};

export type WorkflowProgress = {
  embeddings: StepProgress;
  clusters: StepProgress;
  fts: StepProgress;
  driftEvents: StepProgress;
  influenceGraph: StepProgress;
  clusterDynamics: StepProgress;
  ptmSnapshot: StepProgress;
};

export type WorkflowStatusRecord = {
  id: number;
  workflow: WorkflowType;
  status: WorkflowStatus;
  progress: WorkflowProgress | null;
  clusterJobId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
};

export type WorkflowStatusResult = {
  ok: boolean;
  workflow: WorkflowType | null;
  status: WorkflowStatus;
  progress: WorkflowProgress | null;
  startedAt: string | null;
  elapsed: number | null;
  completedAt: string | null;
  error: string | null;
};

// ============================================
// 初期進捗状態
// ============================================

const createInitialProgress = (): WorkflowProgress => ({
  embeddings: { status: "pending" },
  clusters: { status: "pending" },
  fts: { status: "pending" },
  driftEvents: { status: "pending" },
  influenceGraph: { status: "pending" },
  clusterDynamics: { status: "pending" },
  ptmSnapshot: { status: "pending" },
});

// ============================================
// CRUD 操作
// ============================================

/**
 * ワークフロー開始
 */
export const startWorkflow = async (workflow: WorkflowType): Promise<number> => {
  // テーブルを確実に作成（CREATE TABLE IF NOT EXISTS なので安全）
  await ensureWorkflowStatusTable();

  const now = Math.floor(Date.now() / 1000);
  const initialProgress = createInitialProgress();

  const result = await db.insert(workflowStatus).values({
    workflow,
    status: "running",
    progress: JSON.stringify(initialProgress),
    startedAt: now,
  });

  return Number(result.lastInsertRowid);
};

/**
 * テーブルが存在することを保証する（初回のみ作成）
 */
let tableInitialized = false;
const ensureWorkflowStatusTable = async (): Promise<void> => {
  if (tableInitialized) return;

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS workflow_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow TEXT NOT NULL,
      status TEXT NOT NULL,
      progress TEXT,
      cluster_job_id TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      error TEXT
    )
  `);

  tableInitialized = true;
};

/**
 * ステップ進捗更新
 */
export const updateWorkflowProgress = async (
  workflowId: number,
  stepName: keyof WorkflowProgress,
  stepProgress: StepProgress
): Promise<void> => {
  // 現在の進捗を取得
  const current = await getWorkflowStatus(workflowId);
  if (!current || !current.progress) return;

  // 進捗を更新
  const updatedProgress: WorkflowProgress = {
    ...current.progress,
    [stepName]: stepProgress,
  };

  await db
    .update(workflowStatus)
    .set({
      progress: JSON.stringify(updatedProgress),
    })
    .where(eq(workflowStatus.id, workflowId));
};

/**
 * クラスタジョブIDを記録
 */
export const setClusterJobId = async (
  workflowId: number,
  jobId: string
): Promise<void> => {
  await db
    .update(workflowStatus)
    .set({
      clusterJobId: jobId,
    })
    .where(eq(workflowStatus.id, workflowId));
};

/**
 * ワークフロー完了
 */
export const completeWorkflow = async (workflowId: number): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(workflowStatus)
    .set({
      status: "completed",
      completedAt: now,
    })
    .where(eq(workflowStatus.id, workflowId));
};

/**
 * ワークフロー失敗
 */
export const failWorkflow = async (
  workflowId: number,
  error: string
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(workflowStatus)
    .set({
      status: "failed",
      error,
      completedAt: now,
    })
    .where(eq(workflowStatus.id, workflowId));
};

// ============================================
// クエリ操作
// ============================================

/**
 * ID指定でワークフローステータスを取得
 */
export const getWorkflowStatus = async (
  workflowId: number
): Promise<WorkflowStatusRecord | null> => {
  const result = await db
    .select()
    .from(workflowStatus)
    .where(eq(workflowStatus.id, workflowId))
    .limit(1);

  if (result.length === 0) return null;

  return parseWorkflowRow(result[0]);
};

/**
 * 最新のワークフローステータスを取得
 */
export const getLatestWorkflowStatus = async (): Promise<WorkflowStatusRecord | null> => {
  const result = await db
    .select()
    .from(workflowStatus)
    .orderBy(desc(workflowStatus.id))
    .limit(1);

  if (result.length === 0) return null;

  return parseWorkflowRow(result[0]);
};

/**
 * 実行中のワークフローを取得
 */
export const getRunningWorkflow = async (): Promise<WorkflowStatusRecord | null> => {
  const result = await db
    .select()
    .from(workflowStatus)
    .where(eq(workflowStatus.status, "running"))
    .orderBy(desc(workflowStatus.id))
    .limit(1);

  if (result.length === 0) return null;

  return parseWorkflowRow(result[0]);
};

/**
 * ワークフローステータス結果を取得（API用）
 * - クラスタジョブの進捗も統合
 * - 経過時間を計算
 */
export const getWorkflowStatusResult = async (): Promise<WorkflowStatusResult> => {
  // テーブルを確実に作成
  await ensureWorkflowStatusTable();

  const latest = await getLatestWorkflowStatus();

  // ワークフローが一度も実行されていない場合
  if (!latest) {
    return {
      ok: true,
      workflow: null,
      status: "idle",
      progress: null,
      startedAt: null,
      elapsed: null,
      completedAt: null,
      error: null,
    };
  }

  // クラスタジョブの進捗を取得して統合
  let progress = latest.progress;
  if (latest.status === "running" && latest.clusterJobId && progress) {
    const clusterJob = await getJob(latest.clusterJobId);
    if (clusterJob) {
      progress = {
        ...progress,
        clusters: {
          ...progress.clusters,
          progress: clusterJob.progress ?? undefined,
          message: clusterJob.progressMessage ?? undefined,
        },
      };
    }
  }

  // 経過時間を計算
  const now = Math.floor(Date.now() / 1000);
  const elapsed =
    latest.status === "running" && latest.startedAt
      ? now - latest.startedAt
      : latest.completedAt && latest.startedAt
        ? latest.completedAt - latest.startedAt
        : null;

  return {
    ok: true,
    workflow: latest.workflow,
    status: latest.status,
    progress,
    startedAt: latest.startedAt
      ? new Date(latest.startedAt * 1000).toISOString()
      : null,
    elapsed,
    completedAt: latest.completedAt
      ? new Date(latest.completedAt * 1000).toISOString()
      : null,
    error: latest.error,
  };
};

// ============================================
// ヘルパー
// ============================================

const parseWorkflowRow = (
  row: typeof workflowStatus.$inferSelect
): WorkflowStatusRecord => ({
  id: row.id,
  workflow: row.workflow as WorkflowType,
  status: row.status as WorkflowStatus,
  progress: row.progress ? JSON.parse(row.progress) : null,
  clusterJobId: row.clusterJobId,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  error: row.error,
});

// ============================================
// マイグレーション
// ============================================

/**
 * ワークフローステータステーブルを作成
 */
export const createWorkflowStatusTable = async (): Promise<void> => {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS workflow_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow TEXT NOT NULL,
      status TEXT NOT NULL,
      progress TEXT,
      cluster_job_id TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      error TEXT
    )
  `);
};

/**
 * ワークフローステータステーブルが存在するか確認
 */
export const checkWorkflowStatusTableExists = async (): Promise<boolean> => {
  try {
    const result = await db.all<{ name: string }>(sql`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='workflow_status'
    `);
    return result.length > 0;
  } catch {
    return false;
  }
};
