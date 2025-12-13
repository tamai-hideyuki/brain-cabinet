/**
 * Inference Service
 *
 * ノートの自動分類・推論を管理するサービス
 */

import { db } from "../../db/client";
import { noteInferences } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { inferNoteType, type InferenceResult } from "./inferNoteType";
import {
  classify,
  getTypeWeight,
  getSearchPriority,
  needsReinference,
  type FinalClassification,
} from "./ruleEngine";

export { inferNoteType, type InferenceResult } from "./inferNoteType";
export {
  classify,
  getTypeWeight,
  getSearchPriority,
  needsReinference,
  type FinalClassification,
  type Reliability,
} from "./ruleEngine";

/**
 * ノートを推論し、結果を DB に保存する
 */
export async function inferAndSave(
  noteId: string,
  content: string
): Promise<InferenceResult> {
  const result = inferNoteType(content);

  await db.insert(noteInferences).values({
    noteId,
    type: result.type,
    intent: result.intent,
    confidence: result.confidence,
    confidenceDetail: JSON.stringify(result.confidenceDetail), // v4.1
    decayProfile: result.decayProfile, // v4.2
    model: "rule-v1",
    reasoning: result.reasoning,
  });

  return result;
}

/**
 * ノートの最新推論結果を取得
 */
export async function getLatestInference(
  noteId: string
): Promise<InferenceResult | null> {
  const rows = await db
    .select()
    .from(noteInferences)
    .where(eq(noteInferences.noteId, noteId))
    .orderBy(desc(noteInferences.createdAt))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];

  // v4.1: confidenceDetail をパース（後方互換: 無い場合はデフォルト値）
  const defaultConfidenceDetail = {
    structural: 0,
    experiential: 0,
    temporal: 0,
  };
  let confidenceDetail = defaultConfidenceDetail;
  if (row.confidenceDetail) {
    try {
      confidenceDetail = JSON.parse(row.confidenceDetail);
    } catch {
      // パース失敗時はデフォルト値
    }
  }

  // v4.2: decayProfile（後方互換: 無い場合は exploratory）
  const decayProfile = (row.decayProfile as InferenceResult["decayProfile"]) ?? "exploratory";

  return {
    type: row.type as InferenceResult["type"],
    intent: row.intent as InferenceResult["intent"],
    confidence: row.confidence,
    confidenceDetail,
    decayProfile,
    reasoning: row.reasoning ?? "",
  };
}

/**
 * ノートの最終分類を取得（オンデマンド計算）
 */
export async function getClassification(
  noteId: string
): Promise<FinalClassification | null> {
  const inference = await getLatestInference(noteId);
  if (!inference) return null;
  return classify(inference);
}

/**
 * ノートの全推論履歴を取得
 */
export async function getInferenceHistory(noteId: string) {
  return db
    .select()
    .from(noteInferences)
    .where(eq(noteInferences.noteId, noteId))
    .orderBy(desc(noteInferences.createdAt));
}

/**
 * 再推論が必要なノートIDを取得
 */
export async function getNoteIdsNeedingReinference(): Promise<string[]> {
  const rows = await db
    .select({
      noteId: noteInferences.noteId,
      type: noteInferences.type,
      confidence: noteInferences.confidence,
    })
    .from(noteInferences)
    .orderBy(desc(noteInferences.createdAt));

  // 各ノートの最新推論のみをチェック
  const latestByNote = new Map<
    string,
    { type: string; confidence: number }
  >();
  for (const row of rows) {
    if (!latestByNote.has(row.noteId)) {
      latestByNote.set(row.noteId, {
        type: row.type,
        confidence: row.confidence,
      });
    }
  }

  const needsReinfer: string[] = [];
  for (const [noteId, data] of latestByNote) {
    const inference: InferenceResult = {
      type: data.type as InferenceResult["type"],
      intent: "unknown",
      confidence: data.confidence,
      confidenceDetail: { structural: 0, experiential: 0, temporal: 0 },
      decayProfile: "exploratory",
      reasoning: "",
    };
    const classification = classify(inference);
    if (needsReinference(inference, classification)) {
      needsReinfer.push(noteId);
    }
  }

  return needsReinfer;
}
