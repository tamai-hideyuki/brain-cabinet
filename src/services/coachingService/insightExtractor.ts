/**
 * 苫米地式コーチング - インサイト抽出
 * 会話内容からゴール、スコトーマ、アファメーションを抽出
 */

import type { CoachingInsights } from "../../db/schema";

// CoachingInsightsの各要素の型
type GoalItem = CoachingInsights["goals"][number];
type ScotomaItem = CoachingInsights["scotomas"][number];
type AffirmationItem = CoachingInsights["affirmations"][number];

type ExtractedItem = {
  content: string;
  phase: string;
  turn: number;
  confidence: number;
};

/**
 * ゴール関連のキーワードパターン
 */
const GOAL_PATTERNS = [
  /(?:ゴール|目標|なりたい|達成したい|実現したい)(?:は|として)?[「『]?([^」』。]+)[」』]?/g,
  /[「『]([^」』]+)[」』](?:を|が)(?:ゴール|目標)/g,
  /本当に(?:やりたい|したい|望む)(?:こと|のは)[は]?[「『]?([^」』。]+)[」』]?/g,
  /want to(?:は|として)?[「『]?([^」』。]+)[」』]?/gi,
];

/**
 * スコトーマ（盲点）関連のキーワードパターン
 */
const SCOTOMA_PATTERNS = [
  /(?:気づいた|気づかなかった|見えていなかった|見落としていた)[。、]?[「『]?([^」』。]+)[」』]?/g,
  /(?:盲点|スコトーマ)(?:だった|でした)[。、]?[「『]?([^」』。]+)[」』]?/g,
  /(?:実は|そうか)[、]?([^。]+)(?:だった|ですね)/g,
  /(?:考えたことがなかった|思いつかなかった)[。、]?[「『]?([^」』。]+)[」』]?/g,
];

/**
 * アファメーション関連のパターン
 */
const AFFIRMATION_PATTERNS = [
  /私は[「『]?([^」』。]+)[」』]?(?:である|です|だ)/g,
  /[「『]私は([^」』]+)[」』]/g,
  /アファメーション(?:は|として)?[「『]([^」』]+)[」』]/g,
  /毎日唱える(?:言葉|宣言)(?:は)?[「『]([^」』]+)[」』]/g,
];

/**
 * テキストからパターンマッチでインサイトを抽出
 */
const extractByPattern = (
  text: string,
  patterns: RegExp[],
  phase: string,
  turn: number
): ExtractedItem[] => {
  const results: ExtractedItem[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    // パターンをリセット（gフラグ付きの場合）
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const content = match[1]?.trim();
      if (content && content.length > 5 && content.length < 200 && !seen.has(content)) {
        seen.add(content);
        results.push({
          content,
          phase,
          turn,
          confidence: 0.7,
        });
      }
    }
  }

  return results;
};

/**
 * メッセージ履歴からインサイトを抽出
 */
export const extractInsights = (
  messages: Array<{
    role: "coach" | "user";
    content: string;
    phase: string;
    turn: number;
  }>
): CoachingInsights => {
  const goals: ExtractedItem[] = [];
  const scotomas: ExtractedItem[] = [];
  const affirmations: ExtractedItem[] = [];

  // ユーザーメッセージからのみ抽出
  const userMessages = messages.filter((m) => m.role === "user");

  for (const message of userMessages) {
    // ゴール抽出（ゴール設定フェーズ優先）
    const extractedGoals = extractByPattern(
      message.content,
      GOAL_PATTERNS,
      message.phase,
      message.turn
    );
    // ゴール設定フェーズのものは信頼度を上げる
    extractedGoals.forEach((g) => {
      if (message.phase === "goal_setting") {
        g.confidence = 0.9;
      }
    });
    goals.push(...extractedGoals);

    // スコトーマ抽出（抽象度操作フェーズ優先）
    const extractedScotomas = extractByPattern(
      message.content,
      SCOTOMA_PATTERNS,
      message.phase,
      message.turn
    );
    extractedScotomas.forEach((s) => {
      if (message.phase === "abstraction") {
        s.confidence = 0.9;
      }
    });
    scotomas.push(...extractedScotomas);

    // アファメーション抽出（セルフトークフェーズ優先）
    const extractedAffirmations = extractByPattern(
      message.content,
      AFFIRMATION_PATTERNS,
      message.phase,
      message.turn
    );
    extractedAffirmations.forEach((a) => {
      if (message.phase === "self_talk") {
        a.confidence = 0.9;
      }
    });
    affirmations.push(...extractedAffirmations);
  }

  // 重複を除去し、CoachingInsights形式に変換
  const uniqueGoals = deduplicateExtracted(goals);
  const uniqueScotomas = deduplicateExtracted(scotomas);
  const uniqueAffirmations = deduplicateExtracted(affirmations);

  return {
    goals: uniqueGoals.map((g): GoalItem => ({
      content: g.content,
      isOutsideCurrentState: g.confidence > 0.8, // 高信頼度は現状の外と判定
      wantToScore: g.confidence,
    })),
    scotomas: uniqueScotomas.map((s): ScotomaItem => ({
      content: s.content,
      discoveredAt: Date.now(),
    })),
    affirmations: uniqueAffirmations.map((a): AffirmationItem => ({
      content: a.content,
      efficacyLevel: a.confidence,
    })),
  };
};

/**
 * 重複を除去し、信頼度でソート
 */
const deduplicateExtracted = (items: ExtractedItem[]): ExtractedItem[] => {
  const seen = new Map<string, ExtractedItem>();

  for (const item of items) {
    const key = item.content.toLowerCase();
    const existing = seen.get(key);
    if (!existing || existing.confidence < item.confidence) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // 最大10件
};

/**
 * インサイトをマージ
 */
export const mergeInsights = (
  existing: CoachingInsights,
  extracted: CoachingInsights
): CoachingInsights => {
  // 既存と抽出したものをマージ
  const mergedGoals = [...existing.goals, ...extracted.goals];
  const mergedScotomas = [...existing.scotomas, ...extracted.scotomas];
  const mergedAffirmations = [...existing.affirmations, ...extracted.affirmations];

  // 重複を除去
  const uniqueGoals = deduplicateByContent(mergedGoals);
  const uniqueScotomas = deduplicateByContent(mergedScotomas);
  const uniqueAffirmations = deduplicateByContent(mergedAffirmations);

  return {
    goals: uniqueGoals.slice(0, 10) as GoalItem[],
    scotomas: uniqueScotomas.slice(0, 10) as ScotomaItem[],
    affirmations: uniqueAffirmations.slice(0, 10) as AffirmationItem[],
  };
};

/**
 * contentで重複を除去
 */
const deduplicateByContent = <T extends { content: string }>(items: T[]): T[] => {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = item.content.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
};
