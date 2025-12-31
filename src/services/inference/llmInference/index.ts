/**
 * LLM推論サービス（メインエントリポイント）
 *
 * Ollama + Qwen2.5:3b によるノート分類を実行
 * 閾値ベースの自動反映と週次サマリーを提供
 */

import { db } from "../../../db/client";
import {
  notes,
  noteInferences,
  llmInferenceResults,
  type NoteType,
  type Intent,
  type DecayProfile,
  type LlmInferenceStatus,
} from "../../../db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { logger } from "../../../utils/logger";

import { inferWithOllama, type InferWithLlmOptions } from "./ollamaClient";
import { checkOllamaHealth, isOllamaAvailable } from "./ollamaHealth";
import { isContentTruncated } from "./prompts";
import {
  getLlmInferenceCandidates,
  countLlmInferenceCandidates,
  type LlmInferenceCandidate,
} from "./candidateSelector";
import { inferNoteType } from "../inferNoteType";
import {
  CONFIDENCE_THRESHOLDS,
  BATCH_CONFIG,
  INFERENCE_VERSION,
  DEFAULT_SEED,
  type LlmInferenceExecuteResult,
  type LlmInferenceExecuteResultItem,
  type WeeklySummary,
  type WeeklySummaryStats,
  type PendingItem,
  type RecentAutoAppliedItem,
} from "./types";
import { clearFewShotCache } from "./fewShotExamples";

// ============================================================
// ステータス判定
// ============================================================

/**
 * confidence に基づいてステータスを決定
 */
function determineStatus(confidence: number): LlmInferenceStatus {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPLY_HIGH) {
    return "auto_applied";
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPLY_MID) {
    return "auto_applied_notified";
  }
  return "pending";
}

// ============================================================
// 推論実行
// ============================================================

export type ExecuteLlmInferenceOptions = {
  noteIds?: string[];        // 指定時はこのノートのみ推論
  limit?: number;            // 最大処理件数
  dryRun?: boolean;          // trueならDB保存しない
  model?: string;            // モデル指定
  seed?: number;             // シード値
};

/**
 * LLM推論を実行する
 *
 * @param options 実行オプション
 * @returns 実行結果
 */
export async function executeLlmInference(
  options: ExecuteLlmInferenceOptions = {}
): Promise<LlmInferenceExecuteResult> {
  const limit = options.limit ?? BATCH_CONFIG.MAX_CANDIDATES;
  const dryRun = options.dryRun ?? false;
  const seed = options.seed ?? DEFAULT_SEED;

  logger.info({ limit, dryRun }, "Starting LLM inference execution");

  // Ollamaの可用性チェック
  const ollamaAvailable = await isOllamaAvailable();

  // 候補取得
  let candidates: LlmInferenceCandidate[];
  if (options.noteIds && options.noteIds.length > 0) {
    // 特定ノートを推論
    candidates = [];
    for (const noteId of options.noteIds.slice(0, limit)) {
      const noteData = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
        })
        .from(notes)
        .where(eq(notes.id, noteId))
        .limit(1);

      if (noteData.length > 0) {
        const ruleInference = await db
          .select({
            type: noteInferences.type,
            confidence: noteInferences.confidence,
          })
          .from(noteInferences)
          .where(eq(noteInferences.noteId, noteId))
          .orderBy(desc(noteInferences.createdAt))
          .limit(1);

        candidates.push({
          noteId: noteData[0].id,
          title: noteData[0].title,
          content: noteData[0].content,
          currentType: ruleInference[0]?.type ?? "unknown",
          currentConfidence: ruleInference[0]?.confidence ?? 0,
          reason: "指定ノート",
        });
      }
    }
  } else {
    candidates = await getLlmInferenceCandidates({ limit });
  }

  if (candidates.length === 0) {
    logger.info("No candidates found for LLM inference");
    return { executed: 0, results: [] };
  }

  // バッチ処理（スロットリング）
  const results: LlmInferenceExecuteResultItem[] = [];
  const batchSize = BATCH_CONFIG.MAX_CONCURRENT;

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map((candidate) =>
        processCandidate(candidate, ollamaAvailable, { ...options, seed, dryRun })
      )
    );

    results.push(...batchResults);

    // バッチ間の待機（CPU/GPU負荷軽減）
    if (i + batchSize < candidates.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  logger.info({ executed: results.length }, "LLM inference execution completed");
  return { executed: results.length, results };
}

/**
 * 単一ノートの推論を処理
 */
async function processCandidate(
  candidate: LlmInferenceCandidate,
  ollamaAvailable: boolean,
  options: { seed: number; dryRun: boolean; model?: string }
): Promise<LlmInferenceExecuteResultItem> {
  const { noteId, title, content } = candidate;

  try {
    let type: NoteType;
    let intent: Intent;
    let confidence: number;
    let confidenceDetail: { structural: number; semantic: number; reasoning: number };
    let decayProfile: DecayProfile;
    let reasoning: string;
    let model: string;
    let promptTokens = 0;
    let completionTokens = 0;
    let fallbackUsed = false;
    let contextTruncated = isContentTruncated(content);

    if (ollamaAvailable) {
      // Ollama推論
      const result = await inferWithOllama(content, title, {
        model: options.model,
        seed: options.seed,
      });

      type = result.result.type;
      intent = result.result.intent;
      confidence = result.result.confidence;
      confidenceDetail = result.result.confidenceDetail;
      decayProfile = result.result.decayProfile;
      reasoning = result.result.reasoning;
      model = result.model;
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;
    } else {
      // フォールバック: ルールベース推論
      logger.warn({ noteId }, "Ollama unavailable, using rule-based fallback");
      const ruleResult = inferNoteType(content);

      type = ruleResult.type;
      intent = ruleResult.intent;
      confidence = Math.min(ruleResult.confidence, 0.6); // ルールベースは最大0.6
      confidenceDetail = {
        structural: ruleResult.confidenceDetail.structural,
        semantic: ruleResult.confidenceDetail.experiential,
        reasoning: ruleResult.confidenceDetail.temporal,
      };
      decayProfile = ruleResult.decayProfile;
      reasoning = `[フォールバック] ${ruleResult.reasoning}`;
      model = "rule-v1";
      fallbackUsed = true;
    }

    // ステータス判定
    const status = determineStatus(confidence);

    // DB保存
    if (!options.dryRun) {
      await db.insert(llmInferenceResults).values({
        noteId,
        type,
        intent,
        confidence,
        confidenceDetail: JSON.stringify(confidenceDetail),
        decayProfile,
        reasoning,
        model,
        promptTokens,
        completionTokens,
        contextTruncated: contextTruncated ? 1 : 0,
        fallbackUsed: fallbackUsed ? 1 : 0,
        inferenceVersion: INFERENCE_VERSION,
        seed: options.seed,
        status,
      });

      // 自動反映の場合、noteInferencesも更新
      if (status === "auto_applied" || status === "auto_applied_notified") {
        await db.insert(noteInferences).values({
          noteId,
          type,
          intent,
          confidence,
          confidenceDetail: JSON.stringify(confidenceDetail),
          decayProfile,
          model: `llm-${model}`,
          reasoning,
        });
      }
    }

    return {
      noteId,
      type,
      confidence,
      status,
      reasoning,
    };
  } catch (error) {
    logger.error({ noteId, error }, "Failed to process candidate");
    throw error;
  }
}

// ============================================================
// 保留一覧
// ============================================================

export type GetPendingOptions = {
  limit?: number;
  offset?: number;
};

/**
 * 保留中の推論結果を取得
 */
export async function getPendingResults(
  options: GetPendingOptions = {}
): Promise<{ count: number; items: PendingItem[] }> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  // 件数取得
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.status, "pending"));
  const count = countResult[0]?.count ?? 0;

  // データ取得
  const rows = await db
    .select({
      id: llmInferenceResults.id,
      noteId: llmInferenceResults.noteId,
      type: llmInferenceResults.type,
      confidence: llmInferenceResults.confidence,
      reasoning: llmInferenceResults.reasoning,
      createdAt: llmInferenceResults.createdAt,
    })
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.status, "pending"))
    .orderBy(desc(llmInferenceResults.createdAt))
    .limit(limit)
    .offset(offset);

  // ノート情報を付加
  const items: PendingItem[] = [];
  for (const row of rows) {
    const noteData = await db
      .select({ title: notes.title })
      .from(notes)
      .where(eq(notes.id, row.noteId))
      .limit(1);

    const currentInference = await db
      .select({ type: noteInferences.type })
      .from(noteInferences)
      .where(eq(noteInferences.noteId, row.noteId))
      .orderBy(desc(noteInferences.createdAt))
      .limit(1);

    items.push({
      id: row.id,
      noteId: row.noteId,
      title: noteData[0]?.title ?? "Unknown",
      currentType: (currentInference[0]?.type ?? "scratch") as NoteType,
      suggestedType: row.type as NoteType,
      confidence: row.confidence,
      reasoning: row.reasoning ?? "",
      createdAt: row.createdAt,
    });
  }

  return { count, items };
}

// ============================================================
// 確認推奨（auto_applied_notified）一覧
// ============================================================

export type GetAutoAppliedNotifiedOptions = {
  limit?: number;
  offset?: number;
};

/**
 * 確認推奨（auto_applied_notified）の推論結果を取得
 */
export async function getAutoAppliedNotifiedResults(
  options: GetAutoAppliedNotifiedOptions = {}
): Promise<{ count: number; items: PendingItem[] }> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  // 件数取得
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.status, "auto_applied_notified"));
  const count = countResult[0]?.count ?? 0;

  // データ取得
  const rows = await db
    .select({
      id: llmInferenceResults.id,
      noteId: llmInferenceResults.noteId,
      type: llmInferenceResults.type,
      confidence: llmInferenceResults.confidence,
      reasoning: llmInferenceResults.reasoning,
      createdAt: llmInferenceResults.createdAt,
    })
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.status, "auto_applied_notified"))
    .orderBy(desc(llmInferenceResults.createdAt))
    .limit(limit)
    .offset(offset);

  // ノート情報を付加
  const items: PendingItem[] = [];
  for (const row of rows) {
    const noteData = await db
      .select({ title: notes.title })
      .from(notes)
      .where(eq(notes.id, row.noteId))
      .limit(1);

    // 確認推奨はすでにnoteInferencesに反映済みなので、現在のタイプ = 提案タイプ
    items.push({
      id: row.id,
      noteId: row.noteId,
      title: noteData[0]?.title ?? "Unknown",
      currentType: row.type as NoteType,  // 反映済みなのでLLM推論結果がcurrentType
      suggestedType: row.type as NoteType,
      confidence: row.confidence,
      reasoning: row.reasoning ?? "",
      createdAt: row.createdAt,
    });
  }

  return { count, items };
}

// ============================================================
// ユーザーアクション
// ============================================================

/**
 * 推論結果を承認（pending または auto_applied_notified に対応）
 */
export async function approveResult(resultId: number): Promise<{ success: boolean; message: string }> {
  const result = await db
    .select()
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.id, resultId))
    .limit(1);

  if (result.length === 0) {
    return { success: false, message: "結果が見つかりません" };
  }

  const { noteId, type, intent, confidence, confidenceDetail, decayProfile, reasoning, model, status } = result[0];

  // pending または auto_applied_notified のみ承認可能
  if (status !== "pending" && status !== "auto_applied_notified") {
    return { success: false, message: "このステータスは承認できません" };
  }

  // ステータス更新
  await db
    .update(llmInferenceResults)
    .set({
      status: "approved",
      resolvedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(llmInferenceResults.id, resultId));

  // auto_applied_notified は既にnoteInferencesに反映済みなのでスキップ
  if (status === "pending") {
    await db.insert(noteInferences).values({
      noteId,
      type,
      intent,
      confidence,
      confidenceDetail,
      decayProfile,
      model: `llm-${model}`,
      reasoning,
    });
  }

  // Few-shotキャッシュをクリア（新しい承認例を次回推論に反映するため）
  clearFewShotCache();

  return { success: true, message: "承認しました" };
}


/**
 * 推論結果を上書き（pending または auto_applied_notified に対応）
 * auto_applied_notified の場合は noteInferences を更新
 */
export async function overrideResult(
  resultId: number,
  overrideType: NoteType,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  const result = await db
    .select()
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.id, resultId))
    .limit(1);

  if (result.length === 0) {
    return { success: false, message: "結果が見つかりません" };
  }

  const { noteId, intent, decayProfile, status } = result[0];

  // pending または auto_applied_notified のみ上書き可能
  if (status !== "pending" && status !== "auto_applied_notified") {
    return { success: false, message: "このステータスは上書きできません" };
  }

  // ステータス更新
  await db
    .update(llmInferenceResults)
    .set({
      status: "overridden",
      userOverrideType: overrideType,
      userOverrideReason: reason ?? null,
      resolvedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(llmInferenceResults.id, resultId));

  // auto_applied_notified の場合、既存のnoteInferencesを削除してから新規追加
  if (status === "auto_applied_notified") {
    const latestInference = await db
      .select({ id: noteInferences.id })
      .from(noteInferences)
      .where(eq(noteInferences.noteId, noteId))
      .orderBy(desc(noteInferences.createdAt))
      .limit(1);

    if (latestInference.length > 0) {
      await db
        .delete(noteInferences)
        .where(eq(noteInferences.id, latestInference[0].id));
    }
  }

  // noteInferencesにユーザー指定タイプで反映
  await db.insert(noteInferences).values({
    noteId,
    type: overrideType,
    intent,
    confidence: 1.0, // ユーザー指定は確信度100%
    decayProfile,
    model: "user-override",
    reasoning: reason ?? "ユーザーによる手動分類",
  });

  return { success: true, message: "上書きしました" };
}

// ============================================================
// 週次サマリー
// ============================================================

/**
 * 週次サマリーを生成
 */
export async function getWeeklySummary(): Promise<WeeklySummary> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // 日曜日
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const startTs = Math.floor(weekStart.getTime() / 1000);
  const endTs = Math.floor(weekEnd.getTime() / 1000);

  // 統計を取得
  const allResults = await db
    .select({
      status: llmInferenceResults.status,
    })
    .from(llmInferenceResults)
    .where(
      and(
        gte(llmInferenceResults.createdAt, startTs),
        lte(llmInferenceResults.createdAt, endTs)
      )
    );

  const stats: WeeklySummaryStats = {
    autoAppliedHigh: allResults.filter((r) => r.status === "auto_applied").length,
    autoAppliedMid: allResults.filter((r) => r.status === "auto_applied_notified").length,
    pendingCount: allResults.filter((r) => r.status === "pending").length,
    approvedCount: allResults.filter((r) => r.status === "approved").length,
    overriddenCount: allResults.filter((r) => r.status === "overridden").length,
  };

  // 最近の自動反映（週次通知対象）
  const recentAutoAppliedRows = await db
    .select({
      noteId: llmInferenceResults.noteId,
      type: llmInferenceResults.type,
      confidence: llmInferenceResults.confidence,
      reasoning: llmInferenceResults.reasoning,
      createdAt: llmInferenceResults.createdAt,
    })
    .from(llmInferenceResults)
    .where(
      and(
        eq(llmInferenceResults.status, "auto_applied_notified"),
        gte(llmInferenceResults.createdAt, startTs),
        lte(llmInferenceResults.createdAt, endTs)
      )
    )
    .orderBy(desc(llmInferenceResults.createdAt))
    .limit(10);

  const recentAutoApplied: RecentAutoAppliedItem[] = [];
  for (const row of recentAutoAppliedRows) {
    const noteData = await db
      .select({ title: notes.title })
      .from(notes)
      .where(eq(notes.id, row.noteId))
      .limit(1);

    recentAutoApplied.push({
      noteId: row.noteId,
      title: noteData[0]?.title ?? "Unknown",
      type: row.type as NoteType,
      confidence: row.confidence,
      reasoning: row.reasoning ?? "",
      createdAt: row.createdAt,
    });
  }

  // 保留中アイテム
  const { items: pendingItems } = await getPendingResults({ limit: 10 });

  return {
    weekStart: weekStart.toISOString().split("T")[0],
    weekEnd: weekEnd.toISOString().split("T")[0],
    stats,
    recentAutoApplied,
    pendingItems,
  };
}

// ============================================================
// エクスポート
// ============================================================

export {
  checkOllamaHealth,
  isOllamaAvailable,
  getLlmInferenceCandidates,
  countLlmInferenceCandidates,
};

export type {
  LlmInferenceCandidate,
  LlmInferenceExecuteResult,
  LlmInferenceExecuteResultItem,
  WeeklySummary,
  PendingItem,
};
