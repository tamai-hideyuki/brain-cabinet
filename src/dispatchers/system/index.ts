/**
 * System/Debug ドメイン ディスパッチャー
 */

import * as healthService from "../../services/health";
import * as embeddingService from "../../services/embeddingService";
import * as storageService from "../../services/storageService";
import { findAllNotes } from "../../repositories/notesRepo";
import { rebuildFTS } from "../../repositories/ftsRepo";
import {
  createJobStatusTable,
  checkJobStatusTableExists,
} from "../../repositories/jobStatusRepo";
import {
  createWorkflowStatusTable,
  checkWorkflowStatusTableExists,
} from "../../repositories/workflowStatusRepo";
import { enqueueJob } from "../../services/jobs/job-queue";

export const systemDispatcher = {
  // system.health
  async health() {
    return healthService.performHealthCheck();
  },

  // debug.healthcheck（system.healthと同じ）
  async healthcheck() {
    return healthService.performHealthCheck();
  },

  // system.storage
  async storage() {
    return storageService.getStorageStats();
  },

  // system.embed
  async embed(payload: unknown) {
    const p = payload as { text?: string } | undefined;
    if (!p?.text) {
      throw new Error("text is required");
    }
    const embedding = await embeddingService.generateEmbedding(p.text);
    return {
      text: p.text,
      embedding,
      dimensions: embedding.length,
    };
  },

  // embedding.recalcAll
  async recalcAll(payload: unknown) {
    const p = payload as { force?: boolean } | undefined;
    const force = p?.force ?? false;

    // 非同期で実行（完了を待たない）
    embeddingService.generateAllEmbeddings(() => {
      // プログレスはログに出力
    });

    return {
      message: "Embedding recalculation started",
      force,
    };
  },

  // system.rebuildFts
  async rebuildFts() {
    const allNotes = await findAllNotes();
    await rebuildFTS(allNotes);

    return {
      message: "FTS index rebuilt successfully",
      indexedCount: allNotes.length,
    };
  },

  // system.initJobTable
  async initJobTable() {
    const exists = await checkJobStatusTableExists();
    if (exists) {
      return {
        message: "Job status table already exists",
        created: false,
      };
    }

    await createJobStatusTable();
    return {
      message: "Job status table created successfully",
      created: true,
    };
  },

  // system.initWorkflowTable
  async initWorkflowTable() {
    const exists = await checkWorkflowStatusTableExists();
    if (exists) {
      return {
        message: "Workflow status table already exists",
        created: false,
      };
    }

    await createWorkflowStatusTable();
    return {
      message: "Workflow status table created successfully",
      created: true,
    };
  },

  // system.initTables - すべてのシステムテーブルを初期化
  async initTables() {
    const results = {
      jobStatusTable: { created: false, message: "" },
      workflowStatusTable: { created: false, message: "" },
    };

    // Job status table
    const jobExists = await checkJobStatusTableExists();
    if (!jobExists) {
      await createJobStatusTable();
      results.jobStatusTable = { created: true, message: "Created" };
    } else {
      results.jobStatusTable = { created: false, message: "Already exists" };
    }

    // Workflow status table
    const workflowExists = await checkWorkflowStatusTableExists();
    if (!workflowExists) {
      await createWorkflowStatusTable();
      results.workflowStatusTable = { created: true, message: "Created" };
    } else {
      results.workflowStatusTable = { created: false, message: "Already exists" };
    }

    return results;
  },

  // system.indexStats - HNSWインデックスの統計情報を取得
  async indexStats() {
    return embeddingService.getIndexStats();
  },

  // system.buildIndex - HNSWインデックスを構築・再構築
  async buildIndex() {
    const result = await embeddingService.buildSearchIndex();
    return {
      message: "HNSW index built successfully",
      ...result,
    };
  },

  // system.rebuildIndex - 非同期でHNSWインデックスを再構築（ジョブキュー経由）
  async rebuildIndex() {
    const jobId = await enqueueJob("INDEX_REBUILD");
    return {
      message: "HNSW index rebuild job enqueued",
      jobId,
    };
  },
};
