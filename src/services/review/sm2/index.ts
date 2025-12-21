/**
 * SM-2 Algorithm Implementation
 *
 * SuperMemo 2 algorithm for spaced repetition
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 *
 * 品質評価 (0-5):
 * 0: 完全忘却 - 答えを全く思い出せなかった
 * 1: 不正解 - 答えを見たら思い出した
 * 2: 不正解 - 答えを見たら簡単に思い出せた
 * 3: 正解 - かなり困難だった
 * 4: 正解 - 少し躊躇した
 * 5: 完璧 - 即座に正解できた
 */

import type { RecallQuality } from "../../../db/schema";

// ============================================================
// Types
// ============================================================

export interface SM2State {
  easinessFactor: number; // EF (1.3 - 2.5+)
  interval: number; // days
  repetition: number; // count
}

export interface SM2Result {
  newState: SM2State;
  nextReviewAt: number; // Unix timestamp (seconds)
}

// ============================================================
// Core Algorithm
// ============================================================

/**
 * SM-2 アルゴリズムで次回レビュー状態を計算
 *
 * @param quality - ユーザー評価 0-5
 * @param currentState - 現在のSM-2状態
 * @returns 新しい状態と次回レビュー日時
 */
export function calculateSM2(
  quality: RecallQuality,
  currentState: SM2State
): SM2Result {
  const { easinessFactor, interval, repetition } = currentState;

  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  let newEF =
    easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  // EF は 1.3 未満にならない
  newEF = Math.max(1.3, newEF);

  let newInterval: number;
  let newRepetition: number;

  if (quality < 3) {
    // 失敗（quality < 3）→ リセット
    newRepetition = 0;
    newInterval = 1;
  } else {
    // 成功（quality >= 3）→ 間隔を拡大
    newRepetition = repetition + 1;

    if (repetition === 0) {
      // 初回成功
      newInterval = 1;
    } else if (repetition === 1) {
      // 2回目成功
      newInterval = 6;
    } else {
      // 3回目以降
      newInterval = Math.round(interval * newEF);
    }
  }

  // 次回レビュー日時を計算（Unix timestamp in seconds）
  const now = Math.floor(Date.now() / 1000);
  const nextReviewAt = now + newInterval * 24 * 60 * 60;

  return {
    newState: {
      easinessFactor: Math.round(newEF * 100) / 100, // 小数点2桁で丸め
      interval: newInterval,
      repetition: newRepetition,
    },
    nextReviewAt,
  };
}

/**
 * 新規カードの初期SM-2状態を取得
 */
export function getInitialSM2State(): SM2State {
  return {
    easinessFactor: 2.5,
    interval: 1,
    repetition: 0,
  };
}

/**
 * ノートタイプに基づいて間隔を調整
 *
 * 意思決定ノートはより頻繁にレビューすることで
 * 判断の根拠を忘れないようにする
 */
export function adjustIntervalByNoteType(
  interval: number,
  noteType: "decision" | "learning"
): number {
  if (noteType === "decision") {
    // 意思決定ノートは間隔を20%短くする
    return Math.max(1, Math.round(interval * 0.8));
  }
  return interval;
}

/**
 * 品質評価から次回間隔の予測を計算（プレビュー用）
 */
export function previewNextIntervals(currentState: SM2State): {
  quality: RecallQuality;
  nextInterval: number;
  nextEF: number;
}[] {
  const previews: {
    quality: RecallQuality;
    nextInterval: number;
    nextEF: number;
  }[] = [];

  for (const q of [0, 1, 2, 3, 4, 5] as RecallQuality[]) {
    const result = calculateSM2(q, currentState);
    previews.push({
      quality: q,
      nextInterval: result.newState.interval,
      nextEF: result.newState.easinessFactor,
    });
  }

  return previews;
}

/**
 * 品質評価のラベルを取得
 */
export function getQualityLabel(quality: RecallQuality): string {
  const labels: Record<RecallQuality, string> = {
    0: "完全忘却",
    1: "不正解（思い出した）",
    2: "不正解（簡単に思い出せた）",
    3: "正解（困難）",
    4: "正解（少し躊躇）",
    5: "完璧",
  };
  return labels[quality];
}

/**
 * EF から習熟度の説明を取得
 */
export function getEFDescription(ef: number): string {
  if (ef >= 2.5) return "非常に良い";
  if (ef >= 2.2) return "良い";
  if (ef >= 1.8) return "普通";
  if (ef >= 1.5) return "やや難しい";
  return "難しい";
}

/**
 * 間隔を人間が読みやすい形式に変換
 */
export function formatInterval(days: number): string {
  if (days === 1) return "1日";
  if (days < 7) return `${days}日`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `約${weeks}週間`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `約${months}ヶ月`;
  }
  const years = Math.round(days / 365);
  return `約${years}年`;
}
