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
import {
  evaluate,
  generateMarkdownReport,
  type ClusterPersonaOutput,
  type EvaluationResult,
} from "../../services/voiceEvaluation";
import { db } from "../../db/client";
import { voiceEvaluationLogs } from "../../db/schema";
import { desc, sql } from "drizzle-orm";

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

  // ============================================================
  // Voice Evaluation（観測者ルール評価）
  // ============================================================

  // system.voiceEvaluation.evaluate - 人格化出力を評価して保存
  async evaluateVoice(payload: unknown) {
    const p = payload as {
      output: ClusterPersonaOutput;
      promptVersion?: string;
    } | undefined;

    if (!p?.output) {
      throw new Error("output is required");
    }

    const promptVersion = p.promptVersion ?? "v7.1.0-observer";
    const { markdown, result } = evaluate(p.output, promptVersion);

    // DBに保存
    await db.insert(voiceEvaluationLogs).values({
      clusterId: result.clusterId,
      clusterName: result.clusterName,
      promptVersion: result.promptVersion,
      totalSentences: result.totalSentences,
      assertionCount: result.assertionCount,
      causalCount: result.causalCount,
      assertionRate: result.assertionRate,
      causalRate: result.causalRate,
      structureSeparated: result.structureSeparated ? 1 : 0,
      detectedExpressions: JSON.stringify({
        assertions: result.detectedAssertions,
        causals: result.detectedCausals,
      }),
      rawOutput: JSON.stringify(result.rawOutput),
    });

    return {
      markdown,
      result,
    };
  },

  // system.voiceEvaluation.list - 評価履歴を取得
  async listVoiceEvaluations(payload: unknown) {
    const p = payload as { limit?: number } | undefined;
    const limit = p?.limit ?? 10;

    const rows = await db
      .select()
      .from(voiceEvaluationLogs)
      .orderBy(desc(voiceEvaluationLogs.createdAt))
      .limit(limit);

    return {
      evaluations: rows.map((row) => ({
        id: row.id,
        clusterId: row.clusterId,
        clusterName: row.clusterName,
        promptVersion: row.promptVersion,
        assertionRate: row.assertionRate,
        causalRate: row.causalRate,
        structureSeparated: row.structureSeparated === 1,
        createdAt: row.createdAt,
      })),
      total: rows.length,
    };
  },

  // system.voiceEvaluation.get - 特定の評価詳細を取得
  async getVoiceEvaluation(payload: unknown) {
    const p = payload as { id: number } | undefined;
    if (!p?.id) {
      throw new Error("id is required");
    }

    const rows = await db
      .select()
      .from(voiceEvaluationLogs)
      .where(sql`${voiceEvaluationLogs.id} = ${p.id}`)
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Evaluation not found: ${p.id}`);
    }

    const row = rows[0];
    const detectedExpressions = JSON.parse(row.detectedExpressions);
    const rawOutput = JSON.parse(row.rawOutput) as ClusterPersonaOutput;

    // Markdownレポートを再生成
    const result: EvaluationResult = {
      clusterId: row.clusterId,
      clusterName: row.clusterName,
      evaluatedAt: new Date(row.createdAt * 1000).toISOString(),
      promptVersion: row.promptVersion,
      totalSentences: row.totalSentences,
      assertionCount: row.assertionCount,
      causalCount: row.causalCount,
      assertionRate: row.assertionRate,
      causalRate: row.causalRate,
      structureSeparated: row.structureSeparated === 1,
      detectedAssertions: detectedExpressions.assertions,
      detectedCausals: detectedExpressions.causals,
      fieldEvaluations: [], // 詳細は保存していないので空
      rawOutput,
    };

    return {
      id: row.id,
      markdown: generateMarkdownReport(result),
      result,
    };
  },

  // system.voiceEvaluation.summary - 評価サマリーを取得
  async voiceEvaluationSummary() {
    const rows = await db
      .select()
      .from(voiceEvaluationLogs)
      .orderBy(desc(voiceEvaluationLogs.createdAt))
      .limit(100);

    if (rows.length === 0) {
      return {
        totalEvaluations: 0,
        avgAssertionRate: 0,
        avgCausalRate: 0,
        structureSeparationRate: 0,
      };
    }

    const totalEvaluations = rows.length;
    const avgAssertionRate = Math.round(
      rows.reduce((sum, r) => sum + r.assertionRate, 0) / totalEvaluations
    );
    const avgCausalRate = Math.round(
      rows.reduce((sum, r) => sum + r.causalRate, 0) / totalEvaluations
    );
    const structureSeparationRate = Math.round(
      (rows.filter((r) => r.structureSeparated === 1).length / totalEvaluations) * 100
    );

    return {
      totalEvaluations,
      avgAssertionRate,
      avgCausalRate,
      structureSeparationRate,
    };
  },

  // system.voiceEvaluation.clear - 評価履歴をクリア
  async clearVoiceEvaluations() {
    await db.delete(voiceEvaluationLogs);
    return {
      message: "Voice evaluation logs cleared",
    };
  },
};
