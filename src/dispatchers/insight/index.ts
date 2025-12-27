/**
 * Insight ドメイン ディスパッチャー
 */

import * as ptmEngine from "../../services/ptm/engine";
import { generateAllEmbeddings } from "../../services/embeddingService";
import { rebuildFTS } from "../../repositories/ftsRepo";
import { findAllNotes } from "../../repositories/notesRepo";
import { inferAndSave } from "../../services/inference";
import { rebuildDriftEvents } from "../../services/drift/rebuildDriftEvents";
import { rebuildInfluenceGraph } from "../../services/influence/influenceService";
import { captureClusterDynamics } from "../../services/cluster/clusterDynamicsService";
import { capturePtmSnapshot } from "../../services/ptm/snapshot";
import { enqueueJob } from "../../services/jobs/job-queue";
import { logger } from "../../utils/logger";
import {
  startWorkflow,
  updateWorkflowProgress,
  setClusterJobId,
  completeWorkflow,
  failWorkflow,
} from "../../repositories/workflowStatusRepo";

export type WorkflowReconstructResult = {
  status: "completed" | "partial" | "failed";
  message: string;
  startedAt: string;
  completedAt: string;
  steps: {
    inferences: { status: string; success?: number; failed?: number };
    embeddings: { status: string; success?: number; failed?: number };
    clusters: { status: string; message?: string };
    fts: { status: string; indexedCount?: number };
    driftEvents: { status: string; detected?: number; inserted?: number };
    influenceGraph: { status: string; edgesCreated?: number; notesProcessed?: number };
    clusterDynamics: { status: string; clustersProcessed?: number };
    ptmSnapshot: { status: string; date?: string };
  };
  errors: string[];
};

export const insightDispatcher = {
  async lite() {
    return ptmEngine.generateMetaStateLite();
  },

  async full() {
    return ptmEngine.generateMetaStateFull();
  },

  async coach() {
    const lite = await ptmEngine.generateMetaStateLite();
    return {
      date: lite.date,
      coach: lite.coach,
    };
  },

  /**
   * workflow.reconstruct - 思考分析システム全体を再構築
   *
   * 実行順序（SQLITE_BUSY回避のため、クラスタジョブは最後に実行）:
   * 1. Embedding 再生成（全ノート）
   * 2. FTS インデックス再構築
   * 3. Drift Events 再検出
   * 4. Influence Graph 再計算
   * 5. Cluster Dynamics 再キャプチャ
   * 6. PTM Snapshot 再生成
   * 7. Clustering 再構築（非同期ジョブ - 他のDB操作完了後に実行）
   */
  async reconstruct(): Promise<WorkflowReconstructResult> {
    const startedAt = new Date().toISOString();
    const errors: string[] = [];
    const today = new Date().toISOString().split("T")[0];

    logger.info("[workflow.reconstruct] Starting full workflow reconstruction...");

    // ワークフロー進捗トラッキング開始
    const workflowId = await startWorkflow("reconstruct");

    const steps: WorkflowReconstructResult["steps"] = {
      inferences: { status: "pending" },
      embeddings: { status: "pending" },
      clusters: { status: "pending" },
      fts: { status: "pending" },
      driftEvents: { status: "pending" },
      influenceGraph: { status: "pending" },
      clusterDynamics: { status: "pending" },
      ptmSnapshot: { status: "pending" },
    };

    // Step 1: 全ノート推論（Inference）
    logger.info("[workflow.reconstruct] Step 1: Running inferences for all notes...");
    await updateWorkflowProgress(workflowId, "inferences", { status: "in_progress" });
    try {
      const allNotes = await findAllNotes();
      let success = 0;
      let failed = 0;
      for (const note of allNotes) {
        try {
          await inferAndSave(note.id, note.content);
          success++;
          if (success % 50 === 0) {
            logger.info(`[workflow.reconstruct] Inferences: ${success}/${allNotes.length}`);
          }
        } catch {
          failed++;
        }
      }
      steps.inferences = {
        status: "completed",
        success,
        failed,
      };
      await updateWorkflowProgress(workflowId, "inferences", {
        status: "completed",
        details: { success, failed },
      });
      if (failed > 0) {
        errors.push(`Inference failed for ${failed} notes`);
      }
      logger.info(`[workflow.reconstruct] Inferences completed: ${success} success, ${failed} failed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.inferences = { status: "failed" };
      await updateWorkflowProgress(workflowId, "inferences", {
        status: "failed",
        message,
      });
      errors.push(`Inference generation failed: ${message}`);
      logger.error(`[workflow.reconstruct] Inferences failed: ${message}`);
    }

    // Step 2: Embedding 再生成
    logger.info("[workflow.reconstruct] Step 2: Regenerating embeddings...");
    await updateWorkflowProgress(workflowId, "embeddings", { status: "in_progress" });
    try {
      const embeddingResult = await generateAllEmbeddings((current, total) => {
        if (current % 10 === 0 || current === total) {
          logger.info(`[workflow.reconstruct] Embeddings: ${current}/${total}`);
        }
      });
      steps.embeddings = {
        status: "completed",
        success: embeddingResult.success,
        failed: embeddingResult.failed,
      };
      await updateWorkflowProgress(workflowId, "embeddings", {
        status: "completed",
        details: { success: embeddingResult.success, failed: embeddingResult.failed },
      });
      if (embeddingResult.failed > 0) {
        errors.push(`Embedding generation failed for ${embeddingResult.failed} notes`);
      }
      logger.info(`[workflow.reconstruct] Embeddings completed: ${embeddingResult.success} success, ${embeddingResult.failed} failed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.embeddings = { status: "failed" };
      await updateWorkflowProgress(workflowId, "embeddings", {
        status: "failed",
        message,
      });
      errors.push(`Embedding generation failed: ${message}`);
      logger.error(`[workflow.reconstruct] Embeddings failed: ${message}`);
    }

    // Step 2: FTS インデックス再構築
    logger.info("[workflow.reconstruct] Step 2: Rebuilding FTS index...");
    await updateWorkflowProgress(workflowId, "fts", { status: "in_progress" });
    try {
      const allNotes = await findAllNotes();
      await rebuildFTS(allNotes);
      steps.fts = {
        status: "completed",
        indexedCount: allNotes.length,
      };
      await updateWorkflowProgress(workflowId, "fts", {
        status: "completed",
        details: { indexedCount: allNotes.length },
      });
      logger.info(`[workflow.reconstruct] FTS rebuilt: ${allNotes.length} notes indexed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.fts = { status: "failed" };
      await updateWorkflowProgress(workflowId, "fts", {
        status: "failed",
        message,
      });
      errors.push(`FTS rebuild failed: ${message}`);
      logger.error(`[workflow.reconstruct] FTS rebuild failed: ${message}`);
    }

    // Step 3: Drift Events 再検出
    logger.info("[workflow.reconstruct] Step 3: Rebuilding drift events...");
    await updateWorkflowProgress(workflowId, "driftEvents", { status: "in_progress" });
    try {
      const driftResult = await rebuildDriftEvents();
      steps.driftEvents = {
        status: "completed",
        detected: driftResult.detected,
        inserted: driftResult.inserted,
      };
      await updateWorkflowProgress(workflowId, "driftEvents", {
        status: "completed",
        details: { detected: driftResult.detected, inserted: driftResult.inserted },
      });
      logger.info(`[workflow.reconstruct] Drift events rebuilt: ${driftResult.inserted} events`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.driftEvents = { status: "failed" };
      await updateWorkflowProgress(workflowId, "driftEvents", {
        status: "failed",
        message,
      });
      errors.push(`Drift events rebuild failed: ${message}`);
      logger.error(`[workflow.reconstruct] Drift events failed: ${message}`);
    }

    // Step 4: Influence Graph 再計算
    logger.info("[workflow.reconstruct] Step 4: Rebuilding influence graph...");
    await updateWorkflowProgress(workflowId, "influenceGraph", { status: "in_progress" });
    try {
      const influenceResult = await rebuildInfluenceGraph();
      steps.influenceGraph = {
        status: "completed",
        edgesCreated: influenceResult.edgesCreated,
        notesProcessed: influenceResult.notesProcessed,
      };
      await updateWorkflowProgress(workflowId, "influenceGraph", {
        status: "completed",
        details: { edgesCreated: influenceResult.edgesCreated, notesProcessed: influenceResult.notesProcessed },
      });
      logger.info(`[workflow.reconstruct] Influence graph rebuilt: ${influenceResult.edgesCreated} edges`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.influenceGraph = { status: "failed" };
      await updateWorkflowProgress(workflowId, "influenceGraph", {
        status: "failed",
        message,
      });
      errors.push(`Influence graph rebuild failed: ${message}`);
      logger.error(`[workflow.reconstruct] Influence graph failed: ${message}`);
    }

    // Step 5: Cluster Dynamics 再キャプチャ
    logger.info("[workflow.reconstruct] Step 5: Capturing cluster dynamics...");
    await updateWorkflowProgress(workflowId, "clusterDynamics", { status: "in_progress" });
    try {
      const dynamicsResult = await captureClusterDynamics(today);
      steps.clusterDynamics = {
        status: "completed",
        clustersProcessed: dynamicsResult.length,
      };
      await updateWorkflowProgress(workflowId, "clusterDynamics", {
        status: "completed",
        details: { clustersProcessed: dynamicsResult.length },
      });
      logger.info(`[workflow.reconstruct] Cluster dynamics captured: ${dynamicsResult.length} clusters`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.clusterDynamics = { status: "failed" };
      await updateWorkflowProgress(workflowId, "clusterDynamics", {
        status: "failed",
        message,
      });
      errors.push(`Cluster dynamics capture failed: ${message}`);
      logger.error(`[workflow.reconstruct] Cluster dynamics failed: ${message}`);
    }

    // Step 6: PTM Snapshot 再生成
    logger.info("[workflow.reconstruct] Step 6: Capturing PTM snapshot...");
    await updateWorkflowProgress(workflowId, "ptmSnapshot", { status: "in_progress" });
    try {
      const ptmResult = await capturePtmSnapshot(today);
      steps.ptmSnapshot = {
        status: "completed",
        date: ptmResult.date,
      };
      await updateWorkflowProgress(workflowId, "ptmSnapshot", {
        status: "completed",
        details: { date: ptmResult.date },
      });
      logger.info(`[workflow.reconstruct] PTM snapshot captured: ${ptmResult.date}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.ptmSnapshot = { status: "failed" };
      await updateWorkflowProgress(workflowId, "ptmSnapshot", {
        status: "failed",
        message,
      });
      errors.push(`PTM snapshot capture failed: ${message}`);
      logger.error(`[workflow.reconstruct] PTM snapshot failed: ${message}`);
    }

    // Step 7: Clustering 再構築（非同期ジョブ - 他のDB操作完了後に実行）
    logger.info("[workflow.reconstruct] Step 7: Enqueuing cluster rebuild...");
    await updateWorkflowProgress(workflowId, "clusters", { status: "in_progress" });
    try {
      const jobId = await enqueueJob("CLUSTER_REBUILD", { k: 8, regenerateEmbeddings: false });
      await setClusterJobId(workflowId, jobId);
      steps.clusters = {
        status: "enqueued",
        message: "Cluster rebuild job enqueued (runs asynchronously)",
      };
      await updateWorkflowProgress(workflowId, "clusters", {
        status: "enqueued",
        message: "Cluster rebuild job enqueued (runs asynchronously)",
      });
      logger.info("[workflow.reconstruct] Cluster rebuild job enqueued");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.clusters = { status: "failed" };
      await updateWorkflowProgress(workflowId, "clusters", {
        status: "failed",
        message,
      });
      errors.push(`Cluster rebuild enqueue failed: ${message}`);
      logger.error(`[workflow.reconstruct] Cluster rebuild failed: ${message}`);
    }

    const completedAt = new Date().toISOString();

    // 全体ステータスを判定
    const stepStatuses = Object.values(steps).map((s) => s.status);
    const failedCount = stepStatuses.filter((s) => s === "failed").length;
    const completedCount = stepStatuses.filter((s) => s === "completed" || s === "enqueued").length;

    let status: WorkflowReconstructResult["status"];
    let message: string;

    if (failedCount === 0) {
      status = "completed";
      message = "Workflow reconstruction completed successfully";
    } else if (completedCount > 0) {
      status = "partial";
      message = `Workflow reconstruction partially completed (${failedCount} step(s) failed)`;
    } else {
      status = "failed";
      message = "Workflow reconstruction failed";
    }

    // ワークフロー完了/失敗を記録
    if (status === "failed") {
      await failWorkflow(workflowId, errors.join("; "));
    } else {
      await completeWorkflow(workflowId);
    }

    logger.info(`[workflow.reconstruct] ${message}`);

    return {
      status,
      message,
      startedAt,
      completedAt,
      steps,
      errors,
    };
  },
};
