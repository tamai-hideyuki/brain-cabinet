/**
 * Perspective Questions Generator
 *
 * フェーズ1.5: 他者視点からの問いを自動生成
 */

import {
  Perspective,
  PERSPECTIVES,
  PERSPECTIVE_LABELS,
} from "./types";

// 視点別の問いテンプレート
const QUESTION_TEMPLATES: Record<Perspective, string[]> = {
  engineer: [
    "この設計は技術的に妥当か？パフォーマンスや保守性は考慮されているか？",
    "この実装でエッジケースは網羅されているか？",
    "技術的負債を生まない設計になっているか？",
  ],
  po: [
    "この機能で解決するユーザーの課題は明確か？",
    "これを作ることでどんなビジネス価値が生まれるか？",
    "優先度は適切か？今やるべき理由は何か？",
  ],
  user: [
    "この機能は直感的に使えるか？説明なしで理解できるか？",
    "ユーザーが本当に欲しいのはこれか？代替案はないか？",
    "エラーが起きた時、ユーザーは何をすればいいかわかるか？",
  ],
  cto: [
    "この技術選定は3年後も通用するか？",
    "チーム全体のスキルセットに合っているか？",
    "スケーラビリティは考慮されているか？",
  ],
  team: [
    "この設計を他のメンバーが理解できるか？",
    "ドキュメントやコメントは十分か？",
    "レビューしやすいコードになっているか？",
  ],
  stakeholder: [
    "この投資対効果は説明できるか？",
    "リリースの影響範囲は把握しているか？",
    "リスクとその対策は明確か？",
  ],
};

// 思考トピックに関連した問い
const TOPIC_RELATED_TEMPLATES: Record<Perspective, (topic: string) => string> = {
  engineer: (topic) => `「${topic}」の技術的なトレードオフは検討したか？`,
  po: (topic) => `「${topic}」はユーザーにとってどんな価値があるか？`,
  user: (topic) => `「${topic}」を使うユーザーの気持ちになって考えたか？`,
  cto: (topic) => `「${topic}」の技術選定は長期的に見て正しいか？`,
  team: (topic) => `「${topic}」についてチームメンバーと認識を合わせたか？`,
  stakeholder: (topic) => `「${topic}」のビジネスインパクトを説明できるか？`,
};

/**
 * 他者視点からの問いを生成
 */
export function generatePerspectiveQuestions(
  topicLabels: string[],
  perspectiveDistribution: Record<Perspective, number> | null
): Array<{ perspective: Perspective; question: string }> {
  const questions: Array<{ perspective: Perspective; question: string }> = [];

  // 分布がある場合は、不足している視点を優先
  let targetPerspectives: Perspective[];

  if (perspectiveDistribution) {
    // 視点が少ない順にソート
    targetPerspectives = [...PERSPECTIVES].sort(
      (a, b) => (perspectiveDistribution[a] ?? 0) - (perspectiveDistribution[b] ?? 0)
    );
  } else {
    // 分布がない場合はデフォルト順
    targetPerspectives = ["po", "user", "cto"];
  }

  // 上位3つの視点から問いを生成
  for (const perspective of targetPerspectives.slice(0, 3)) {
    let question: string;

    if (topicLabels.length > 0) {
      // トピックがある場合はトピック関連の問い
      const topic = topicLabels[0];
      question = TOPIC_RELATED_TEMPLATES[perspective](topic);
    } else {
      // トピックがない場合はテンプレートからランダム選択
      const templates = QUESTION_TEMPLATES[perspective];
      question = templates[Math.floor(Math.random() * templates.length)];
    }

    questions.push({ perspective, question });
  }

  return questions;
}

/**
 * 特定の視点に対するガイド質問を取得（フェーズ3用）
 */
export function getGuideQuestions(perspective: Perspective): string[] {
  return QUESTION_TEMPLATES[perspective];
}
