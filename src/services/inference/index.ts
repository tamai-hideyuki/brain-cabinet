/**
 * Inference Service
 *
 * ノートの自動分類・推論を管理するサービス
 */

import * as inferenceRepo from "../../repositories/inferenceRepo";
import { inferNoteType, type InferenceResult } from "./inferNoteType";
import {
  classify,
  getTypeWeight,
  getSearchPriority,
  needsReinference,
  type FinalClassification,
} from "./ruleEngine";
import {
  checkPromotionTriggers,
  createPromotionNotification,
} from "../promotion";
import { handleNoteTypeChange } from "../review";

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
 * v4.3: 昇格候補の検出も行う
 */
export async function inferAndSave(
  noteId: string,
  content: string
): Promise<InferenceResult> {
  // 前回の推論結果を取得（昇格チェック用）
  const previousInference = await getLatestInference(noteId);

  const result = inferNoteType(content);

  await inferenceRepo.insertNoteInference({
    noteId,
    type: result.type,
    intent: result.intent,
    confidence: result.confidence,
    confidenceDetail: JSON.stringify(result.confidenceDetail), // v4.1
    decayProfile: result.decayProfile, // v4.2
    model: "rule-v1",
    reasoning: result.reasoning,
  });

  // v4.3: 昇格候補の検出（非同期で実行、エラーは無視）
  checkPromotionTriggers(noteId, result, previousInference)
    .then((triggerResult) => {
      if (triggerResult.shouldNotify) {
        return createPromotionNotification(noteId, triggerResult, "realtime");
      }
    })
    .catch((err) => {
      // 昇格チェックのエラーは推論処理に影響させない
      console.error("Promotion check failed:", err);
    });

  // v4.5: Spaced Review 自動スケジュール（非同期で実行、エラーは無視）
  handleNoteTypeChange(
    noteId,
    result.type,
    content,
    previousInference?.type
  ).catch((err) => {
    // レビュースケジュールのエラーは推論処理に影響させない
    console.error("Review scheduling failed:", err);
  });

  return result;
}

/**
 * ノートの最新推論結果を取得
 */
export async function getLatestInference(
  noteId: string
): Promise<InferenceResult | null> {
  const row = await inferenceRepo.findLatestInference(noteId);

  if (!row) return null;

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
  return inferenceRepo.findInferenceHistory(noteId);
}

/**
 * 再推論が必要なノートIDを取得
 */
export async function getNoteIdsNeedingReinference(): Promise<string[]> {
  const rows = await inferenceRepo.findAllLatestInferences();

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
