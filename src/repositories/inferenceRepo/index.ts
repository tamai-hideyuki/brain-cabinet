/**
 * Inference Repository
 *
 * noteInferences / llmInferenceResults テーブルへのDB操作を集約
 */

import { db } from "../../db/client";
import {
  notes,
  noteInferences,
  llmInferenceResults,
  type NoteType,
  type LlmInferenceStatus,
} from "../../db/schema";
import { eq, desc, and, gte, lte, lt, notInArray, inArray, sql } from "drizzle-orm";

// ============================================================
// 型定義
// ============================================================

export type NoteInferenceInsert = {
  noteId: string;
  type: string;
  intent: string;
  confidence: number;
  confidenceDetail?: string;
  decayProfile?: string;
  model: string;
  reasoning?: string;
};

export type LlmInferenceResultInsert = {
  noteId: string;
  type: string;
  intent: string;
  confidence: number;
  confidenceDetail: string;
  decayProfile: string;
  reasoning: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  contextTruncated: number;
  fallbackUsed: number;
  inferenceVersion: string;
  seed: number;
  status: LlmInferenceStatus;
};

export type NoteBasicInfo = {
  id: string;
  title: string;
  content: string;
};

export type NoteInferenceRow = {
  type: string;
  confidence: number;
};

export type LlmResultRow = {
  id: number;
  noteId: string;
  type: string;
  confidence: number;
  reasoning: string | null;
  createdAt: number;
};

export type LlmResultFullRow = typeof llmInferenceResults.$inferSelect;

export type FewShotResultRow = {
  noteId: string;
  type: string;
  confidence: number;
  reasoning: string | null;
  resolvedAt: number | null;
};

export type WeeklyStatsRow = {
  status: string | null;
};

// ============================================================
// noteInferences 操作
// ============================================================

/**
 * 推論結果を保存
 */
export const insertNoteInference = async (data: NoteInferenceInsert): Promise<void> => {
  await db.insert(noteInferences).values({
    noteId: data.noteId,
    type: data.type,
    intent: data.intent,
    confidence: data.confidence,
    confidenceDetail: data.confidenceDetail,
    decayProfile: data.decayProfile,
    model: data.model,
    reasoning: data.reasoning,
  });
};

/**
 * ノートの最新推論を取得
 */
export const findLatestInference = async (noteId: string) => {
  const rows = await db
    .select()
    .from(noteInferences)
    .where(eq(noteInferences.noteId, noteId))
    .orderBy(desc(noteInferences.createdAt))
    .limit(1);
  return rows[0] ?? null;
};

/**
 * ノートの推論履歴を取得
 */
export const findInferenceHistory = async (noteId: string) => {
  return db
    .select()
    .from(noteInferences)
    .where(eq(noteInferences.noteId, noteId))
    .orderBy(desc(noteInferences.createdAt));
};

/**
 * 全ノートの最新推論を取得（再推論チェック用）
 */
export const findAllLatestInferences = async () => {
  return db
    .select({
      noteId: noteInferences.noteId,
      type: noteInferences.type,
      confidence: noteInferences.confidence,
    })
    .from(noteInferences)
    .orderBy(desc(noteInferences.createdAt));
};

/**
 * ノートIDで最新の推論タイプと信頼度を取得
 */
export const findLatestInferenceBasic = async (
  noteId: string
): Promise<NoteInferenceRow | null> => {
  const result = await db
    .select({
      type: noteInferences.type,
      confidence: noteInferences.confidence,
    })
    .from(noteInferences)
    .where(eq(noteInferences.noteId, noteId))
    .orderBy(desc(noteInferences.createdAt))
    .limit(1);
  return result[0] ?? null;
};

/**
 * 最新の推論IDを取得してから削除
 */
export const deleteLatestInference = async (noteId: string): Promise<void> => {
  const latest = await db
    .select({ id: noteInferences.id })
    .from(noteInferences)
    .where(eq(noteInferences.noteId, noteId))
    .orderBy(desc(noteInferences.createdAt))
    .limit(1);

  if (latest.length > 0) {
    await db.delete(noteInferences).where(eq(noteInferences.id, latest[0].id));
  }
};

// ============================================================
// llmInferenceResults 操作
// ============================================================

/**
 * LLM推論結果を保存
 */
export const insertLlmResult = async (data: LlmInferenceResultInsert): Promise<void> => {
  await db.insert(llmInferenceResults).values(data);
};

/**
 * LLM推論結果をIDで取得
 */
export const findLlmResultById = async (id: number): Promise<LlmResultFullRow | null> => {
  const result = await db
    .select()
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.id, id))
    .limit(1);
  return result[0] ?? null;
};

/**
 * LLM推論結果のステータスを更新
 */
export const updateLlmResultStatus = async (
  id: number,
  status: LlmInferenceStatus,
  extra?: { userOverrideType?: string; userOverrideReason?: string | null }
): Promise<void> => {
  await db
    .update(llmInferenceResults)
    .set({
      status,
      resolvedAt: Math.floor(Date.now() / 1000),
      ...(extra?.userOverrideType && { userOverrideType: extra.userOverrideType }),
      ...(extra?.userOverrideReason !== undefined && {
        userOverrideReason: extra.userOverrideReason,
      }),
    })
    .where(eq(llmInferenceResults.id, id));
};

/**
 * 保留中の推論結果数を取得
 */
export const countPendingResults = async (): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.status, "pending"));
  return result[0]?.count ?? 0;
};

/**
 * 保留中の推論結果を取得
 */
export const findPendingResults = async (
  limit: number,
  offset: number
): Promise<LlmResultRow[]> => {
  return db
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
};

/**
 * auto_applied_notified の推論結果数を取得
 */
export const countAutoAppliedNotifiedResults = async (): Promise<number> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(llmInferenceResults)
    .where(eq(llmInferenceResults.status, "auto_applied_notified"));
  return result[0]?.count ?? 0;
};

/**
 * auto_applied_notified の推論結果を取得
 */
export const findAutoAppliedNotifiedResults = async (
  limit: number,
  offset: number
): Promise<LlmResultRow[]> => {
  return db
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
};

/**
 * 既存のLLM推論済みノートIDを取得
 */
export const findExistingLlmNoteIds = async (): Promise<string[]> => {
  const results = await db
    .select({ noteId: llmInferenceResults.noteId })
    .from(llmInferenceResults);
  return results.map((r) => r.noteId);
};

/**
 * Few-shot用の承認済み結果を取得
 */
export const findApprovedForFewShot = async (
  noteType: string,
  minConfidence: number,
  limit: number
): Promise<FewShotResultRow[]> => {
  return db
    .select({
      noteId: llmInferenceResults.noteId,
      type: llmInferenceResults.type,
      confidence: llmInferenceResults.confidence,
      reasoning: llmInferenceResults.reasoning,
      resolvedAt: llmInferenceResults.resolvedAt,
    })
    .from(llmInferenceResults)
    .where(
      and(
        eq(llmInferenceResults.type, noteType),
        gte(llmInferenceResults.confidence, minConfidence),
        inArray(llmInferenceResults.status, ["approved", "auto_applied"])
      )
    )
    .orderBy(desc(llmInferenceResults.resolvedAt))
    .limit(limit);
};

/**
 * 週間の推論結果統計を取得
 */
export const findWeeklyResults = async (
  startTs: number,
  endTs: number
): Promise<WeeklyStatsRow[]> => {
  return db
    .select({ status: llmInferenceResults.status })
    .from(llmInferenceResults)
    .where(
      and(
        gte(llmInferenceResults.createdAt, startTs),
        lte(llmInferenceResults.createdAt, endTs)
      )
    );
};

/**
 * 週間の自動適用通知済み結果を取得
 */
export const findWeeklyAutoAppliedNotified = async (
  startTs: number,
  endTs: number,
  limit: number
) => {
  return db
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
    .limit(limit);
};

// ============================================================
// notes テーブル参照（inference用）
// ============================================================

/**
 * ノートの基本情報を取得
 */
export const findNoteBasicInfo = async (noteId: string): Promise<NoteBasicInfo | null> => {
  const result = await db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
    })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  return result[0] ?? null;
};

/**
 * ノートタイトルのみ取得
 */
export const findNoteTitle = async (noteId: string): Promise<string | null> => {
  const result = await db
    .select({ title: notes.title })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  return result[0]?.title ?? null;
};

/**
 * LLM推論未実行のノートを取得
 */
export const findNotesWithoutLlmInference = async (
  excludeNoteIds: string[],
  limit: number
) => {
  return db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(
      excludeNoteIds.length > 0
        ? notInArray(notes.id, excludeNoteIds)
        : sql`1=1`
    )
    .orderBy(desc(notes.updatedAt))
    .limit(limit);
};

/**
 * 低信頼度の推論を持つノートを取得
 */
export const findLowConfidenceInferences = async (
  threshold: number,
  excludeNoteIds: string[],
  limit: number
) => {
  return db
    .select({
      noteId: noteInferences.noteId,
      type: noteInferences.type,
      confidence: noteInferences.confidence,
    })
    .from(noteInferences)
    .where(
      and(
        lt(noteInferences.confidence, threshold),
        excludeNoteIds.length > 0
          ? notInArray(noteInferences.noteId, excludeNoteIds)
          : sql`1=1`
      )
    )
    .orderBy(noteInferences.confidence)
    .limit(limit);
};

/**
 * scratchタイプのノートを取得（LLM推論候補用）
 */
export const findScratchTypeNotes = async (excludeNoteIds: string[], limit: number) => {
  return db
    .select({
      noteId: noteInferences.noteId,
      confidence: noteInferences.confidence,
    })
    .from(noteInferences)
    .innerJoin(notes, eq(noteInferences.noteId, notes.id))
    .where(
      and(
        eq(noteInferences.type, "scratch"),
        excludeNoteIds.length > 0
          ? notInArray(noteInferences.noteId, excludeNoteIds)
          : sql`1=1`
      )
    )
    .orderBy(desc(notes.updatedAt))
    .limit(limit);
};
