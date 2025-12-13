/**
 * Promotion Service
 *
 * scratch ノートの昇格候補を検出・管理するサービス
 * - checkPromotionTriggers: ノート保存時に昇格候補かどうかを検出
 * - getPendingPromotions: 未対応の昇格通知一覧を取得
 * - dismissPromotion: 昇格を却下
 * - acceptPromotion: 昇格を実行
 *
 * 設計原則: 自動昇格しない。検出して提案するだけ。決めるのは人間。
 */

import { db } from "../../db/client";
import {
  promotionNotifications,
  notes,
  noteInferences,
  type NoteType,
  type PromotionTriggerType,
  type PromotionSource,
  type PromotionStatus,
} from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { InferenceResult } from "../inference/inferNoteType";

// -------------------------------------
// 定数
// -------------------------------------

const THRESHOLDS = {
  // confidence が昇格閾値に近づいたと判断する値
  CONFIDENCE_NEAR_THRESHOLD: 0.55,
  // 昇格可能とみなす最小 confidence
  CONFIDENCE_PROMOTION_MIN: 0.4,
  // クールダウン期間（日）- 同じノートへの通知を抑制
  COOLDOWN_DAYS: 7,
};

// -------------------------------------
// 型定義
// -------------------------------------

export type PromotionNotification = {
  id: number;
  noteId: string;
  noteTitle: string;
  triggerType: PromotionTriggerType;
  source: PromotionSource;
  suggestedType: NoteType;
  reason: string;
  confidence: number;
  reasonDetail?: {
    confidenceDelta?: number;
    previousConfidence?: number;
    frequencyCount?: number;
    matchedPatterns?: string[];
  };
  status: PromotionStatus;
  createdAt: number;
};

export type CheckTriggerResult = {
  shouldNotify: boolean;
  triggerType?: PromotionTriggerType;
  suggestedType?: NoteType;
  reason?: string;
  reasonDetail?: PromotionNotification["reasonDetail"];
};

// -------------------------------------
// 検出ロジック
// -------------------------------------

/**
 * ノート保存時に昇格候補かどうかを検出
 *
 * 条件:
 * 1. 現在 scratch タイプである
 * 2. confidence が閾値に近づいている（0.55以上）
 * 3. 同一ノート・同一トリガーで pending の通知がない（スパム防止）
 */
export async function checkPromotionTriggers(
  noteId: string,
  currentInference: InferenceResult,
  previousInference: InferenceResult | null
): Promise<CheckTriggerResult> {
  // scratch 以外は対象外
  if (currentInference.type !== "scratch") {
    return { shouldNotify: false };
  }

  // confidence が閾値未満は対象外
  if (currentInference.confidence < THRESHOLDS.CONFIDENCE_NEAR_THRESHOLD) {
    return { shouldNotify: false };
  }

  // 既に pending の通知があるかチェック（スパム防止）
  const existingPending = await db
    .select({ id: promotionNotifications.id })
    .from(promotionNotifications)
    .where(
      and(
        eq(promotionNotifications.noteId, noteId),
        eq(promotionNotifications.triggerType, "confidence_rise"),
        eq(promotionNotifications.status, "pending")
      )
    )
    .limit(1);

  if (existingPending.length > 0) {
    return { shouldNotify: false };
  }

  // confidence の上昇を検出
  const confidenceDelta = previousInference
    ? currentInference.confidence - previousInference.confidence
    : 0;

  // 推奨タイプを判定
  const suggestedType = determineSuggestedType(currentInference);

  // 理由を生成
  const reason = generateReason(currentInference, suggestedType, confidenceDelta);

  return {
    shouldNotify: true,
    triggerType: "confidence_rise",
    suggestedType,
    reason,
    reasonDetail: {
      confidenceDelta: Math.round(confidenceDelta * 100) / 100,
      previousConfidence: previousInference?.confidence,
    },
  };
}

/**
 * 推奨タイプを判定
 */
function determineSuggestedType(inference: InferenceResult): NoteType {
  // reasoning に判断要素が含まれているか
  if (
    inference.reasoning.includes("判断表現") ||
    inference.intent === "architecture" ||
    inference.intent === "design"
  ) {
    return "decision";
  }

  // 学習・知識系の intent
  if (
    inference.reasoning.includes("学習表現") ||
    inference.intent === "implementation" ||
    inference.intent === "review"
  ) {
    return "learning";
  }

  // デフォルトは learning（decision より低いハードル）
  return "learning";
}

/**
 * 人間向けの理由文を生成
 */
function generateReason(
  inference: InferenceResult,
  suggestedType: NoteType,
  confidenceDelta: number
): string {
  const typeLabel = suggestedType === "decision" ? "判断メモ" : "学習メモ";

  if (confidenceDelta > 0.1) {
    return `confidence が大きく上昇しました（+${Math.round(confidenceDelta * 100)}%）。${typeLabel}に昇格できそうです。`;
  }

  if (inference.confidenceDetail.structural >= 0.3) {
    return `断定的な表現が増えています。${typeLabel}に昇格できそうです。`;
  }

  return `内容が整理されてきました。${typeLabel}に昇格できそうです。`;
}

// -------------------------------------
// 通知の保存
// -------------------------------------

/**
 * 昇格通知を保存
 */
export async function createPromotionNotification(
  noteId: string,
  result: CheckTriggerResult,
  source: PromotionSource = "realtime"
): Promise<void> {
  if (!result.shouldNotify || !result.triggerType || !result.suggestedType) {
    return;
  }

  await db.insert(promotionNotifications).values({
    noteId,
    triggerType: result.triggerType,
    source,
    suggestedType: result.suggestedType,
    reason: result.reason ?? "",
    confidence: 0, // 後で取得
    reasonDetail: result.reasonDetail
      ? JSON.stringify(result.reasonDetail)
      : null,
    status: "pending",
  });
}

// -------------------------------------
// 通知の取得
// -------------------------------------

/**
 * 未対応の昇格通知一覧を取得
 */
export async function getPendingPromotions(
  limit = 20
): Promise<PromotionNotification[]> {
  const rows = await db
    .select({
      id: promotionNotifications.id,
      noteId: promotionNotifications.noteId,
      triggerType: promotionNotifications.triggerType,
      source: promotionNotifications.source,
      suggestedType: promotionNotifications.suggestedType,
      reason: promotionNotifications.reason,
      confidence: promotionNotifications.confidence,
      reasonDetail: promotionNotifications.reasonDetail,
      status: promotionNotifications.status,
      createdAt: promotionNotifications.createdAt,
    })
    .from(promotionNotifications)
    .where(eq(promotionNotifications.status, "pending"))
    .orderBy(desc(promotionNotifications.createdAt))
    .limit(limit);

  // ノートタイトルを取得
  const results: PromotionNotification[] = [];
  for (const row of rows) {
    const noteRows = await db
      .select({ title: notes.title })
      .from(notes)
      .where(eq(notes.id, row.noteId))
      .limit(1);

    const noteTitle = noteRows[0]?.title ?? "(削除済み)";

    let reasonDetail: PromotionNotification["reasonDetail"];
    if (row.reasonDetail) {
      try {
        reasonDetail = JSON.parse(row.reasonDetail);
      } catch {
        // パース失敗時は undefined
      }
    }

    results.push({
      id: row.id,
      noteId: row.noteId,
      noteTitle,
      triggerType: row.triggerType as PromotionTriggerType,
      source: row.source as PromotionSource,
      suggestedType: row.suggestedType as NoteType,
      reason: row.reason,
      confidence: row.confidence,
      reasonDetail,
      status: row.status as PromotionStatus,
      createdAt: row.createdAt,
    });
  }

  return results;
}

// -------------------------------------
// 通知への対応
// -------------------------------------

/**
 * 昇格を却下
 */
export async function dismissPromotion(notificationId: number): Promise<void> {
  await db
    .update(promotionNotifications)
    .set({
      status: "dismissed",
      resolvedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(promotionNotifications.id, notificationId));
}

/**
 * 昇格を実行
 *
 * 注: 実際のタイプ変更は note_inferences の再推論で行う
 * ここでは通知のステータスを更新するだけ
 */
export async function acceptPromotion(notificationId: number): Promise<{
  noteId: string;
  suggestedType: NoteType;
}> {
  // 通知を取得
  const rows = await db
    .select({
      noteId: promotionNotifications.noteId,
      suggestedType: promotionNotifications.suggestedType,
    })
    .from(promotionNotifications)
    .where(eq(promotionNotifications.id, notificationId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error(`Notification not found: ${notificationId}`);
  }

  const { noteId, suggestedType } = rows[0];

  // ステータスを更新
  await db
    .update(promotionNotifications)
    .set({
      status: "promoted",
      resolvedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(promotionNotifications.id, notificationId));

  return {
    noteId,
    suggestedType: suggestedType as NoteType,
  };
}

/**
 * 特定ノートの pending 通知をすべてクリア
 * （ノート削除時などに使用）
 */
export async function clearPendingNotifications(noteId: string): Promise<void> {
  await db
    .update(promotionNotifications)
    .set({
      status: "dismissed",
      resolvedAt: Math.floor(Date.now() / 1000),
    })
    .where(
      and(
        eq(promotionNotifications.noteId, noteId),
        eq(promotionNotifications.status, "pending")
      )
    );
}
