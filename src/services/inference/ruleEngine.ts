/**
 * Rule Engine - FinalClassification
 *
 * LLM推論結果から「最終的な扱い方」を決定する
 * FinalClassification は DB に保存せず、オンデマンドで計算する
 */

import type { NoteType } from "../../db/schema";
import type { InferenceResult } from "./inferNoteType";

export type Reliability = "high" | "mid" | "low";

export type FinalClassification = {
  primaryType: NoteType;
  secondaryTypes: NoteType[];
  reliability: Reliability;
};

/**
 * 推論結果から最終分類を計算する
 *
 * ルール設計思想:
 * - decision は最優先
 * - confidence で役割を変える
 * - 迷ったら scratch に落とす
 */
export function classify(inference: InferenceResult): FinalClassification {
  const { type, confidence } = inference;

  // Rule 1: decision 強制昇格（confidence >= 0.7）
  // ※ ルールベースでは最大 0.6 なので、LLM推論後に適用される
  if (type === "decision" && confidence >= 0.7) {
    return {
      primaryType: "decision",
      secondaryTypes: [],
      reliability: "high",
    };
  }

  // Rule 2: decision 候補（0.4 <= confidence < 0.7）
  if (type === "decision" && confidence >= 0.4) {
    return {
      primaryType: "decision",
      secondaryTypes: ["scratch"],
      reliability: "mid",
    };
  }

  // Rule 3: learning 主役（confidence >= 0.6）
  if (type === "learning" && confidence >= 0.6) {
    return {
      primaryType: "learning",
      secondaryTypes: [],
      reliability: "high",
    };
  }

  // Rule 4: learning + scratch 混合（confidence < 0.6）
  if (type === "learning" && confidence >= 0.4) {
    return {
      primaryType: "scratch",
      secondaryTypes: ["learning"],
      reliability: "mid",
    };
  }

  // Rule 5: emotion はそのまま保持
  if (type === "emotion" && confidence >= 0.4) {
    return {
      primaryType: "emotion",
      secondaryTypes: [],
      reliability: "mid",
    };
  }

  // Rule 6: log はそのまま保持
  if (type === "log" && confidence >= 0.4) {
    return {
      primaryType: "log",
      secondaryTypes: [],
      reliability: "mid",
    };
  }

  // Rule 7: その他は低信頼 scratch
  return {
    primaryType: "scratch",
    secondaryTypes: [],
    reliability: "low",
  };
}

/**
 * PTM / Cluster での重み付け係数を取得
 */
export function getTypeWeight(primaryType: NoteType): number {
  switch (primaryType) {
    case "decision":
      return 1.0;
    case "learning":
      return 0.6;
    case "scratch":
      return 0.2;
    case "emotion":
    case "log":
      return 0.1;
    default:
      return 0.1;
  }
}

/**
 * 検索での優先度スコアを取得
 */
export function getSearchPriority(
  primaryType: NoteType,
  reliability: Reliability
): number {
  const typeScore =
    primaryType === "decision"
      ? 100
      : primaryType === "learning"
        ? 60
        : primaryType === "scratch"
          ? 20
          : 10;

  const reliabilityMultiplier =
    reliability === "high" ? 1.0 : reliability === "mid" ? 0.7 : 0.4;

  return typeScore * reliabilityMultiplier;
}

/**
 * 再推論が必要かどうかを判定
 */
export function needsReinference(
  inference: InferenceResult,
  classification: FinalClassification
): boolean {
  // confidence が低い場合
  if (inference.confidence < 0.6) return true;

  // decision だが reliability が mid の場合
  if (
    classification.primaryType === "decision" &&
    classification.reliability === "mid"
  ) {
    return true;
  }

  return false;
}
