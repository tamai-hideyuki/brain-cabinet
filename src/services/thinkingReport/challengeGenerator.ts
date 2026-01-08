/**
 * Challenge Generator
 *
 * フェーズ2.5: 週次チャレンジを生成
 */

import {
  Perspective,
  PERSPECTIVES,
  PERSPECTIVE_LABELS,
} from "./types";

// 視点別のチャレンジ問い
const CHALLENGE_QUESTIONS: Record<Perspective, string[]> = {
  engineer: [
    "今取り組んでいる機能の技術的なリスクを洗い出してみてください。",
    "コードレビューで指摘されそうなポイントを先に自己レビューしてみてください。",
    "パフォーマンスのボトルネックになりそうな箇所を特定してみてください。",
  ],
  po: [
    "今取り組んでいる機能のユーザーストーリーを書いてみてください。",
    "この機能のKPIを3つ挙げてみてください。",
    "この機能をリリースしない場合のビジネスインパクトを考えてみてください。",
  ],
  user: [
    "実際にユーザーになったつもりで機能を使ってみて、感想をメモしてください。",
    "ユーザーが最初につまずきそうなポイントを3つ挙げてみてください。",
    "競合サービスのUXと比較して、改善点を考えてみてください。",
  ],
  cto: [
    "現在の技術スタックを2年後の視点で評価してみてください。",
    "チーム全体の技術力向上につながる取り組みを1つ提案してみてください。",
    "技術的負債のトップ3を洗い出し、返済計画を考えてみてください。",
  ],
  team: [
    "今週のあなたの作業を、他のメンバーに1分で説明できるようにまとめてください。",
    "チームで共有すべき知見や学びを1つドキュメントにしてください。",
    "ペアプログラミングやモブプログラミングを1回試してみてください。",
  ],
  stakeholder: [
    "今取り組んでいる機能のROIを概算してみてください。",
    "経営層に進捗を報告するとしたら、何を強調しますか？",
    "このプロジェクトの成功/失敗の基準を明確にしてください。",
  ],
};

// 不足している視点に対するメッセージ
const LACK_MESSAGES: Record<Perspective, string> = {
  engineer: "技術的な深堀りが不足しています。",
  po: "ビジネス視点での思考が不足しています。",
  user: "ユーザー視点での思考が不足しています。",
  cto: "技術戦略視点での思考が不足しています。",
  team: "チーム視点での思考が不足しています。",
  stakeholder: "ステークホルダー視点での思考が不足しています。",
};

/**
 * 週次チャレンジを生成
 */
export function generateWeeklyChallenge(
  perspectiveDistribution: Record<Perspective, number> | null
): {
  targetPerspective: Perspective;
  question: string;
  reason: string;
} | null {
  // 分布がない場合はデフォルトでPO視点を推奨
  if (!perspectiveDistribution) {
    const questions = CHALLENGE_QUESTIONS.po;
    return {
      targetPerspective: "po",
      question: questions[Math.floor(Math.random() * questions.length)],
      reason: "まだ視点データが蓄積されていません。まずはPO視点でノートを書いてみましょう。",
    };
  }

  // 最も不足している視点を特定
  let minPerspective: Perspective = "po";
  let minValue = 100;

  for (const perspective of PERSPECTIVES) {
    const value = perspectiveDistribution[perspective] ?? 0;
    if (value < minValue) {
      minValue = value;
      minPerspective = perspective;
    }
  }

  // 10%未満の視点がなければチャレンジ不要
  if (minValue >= 10) {
    return null;
  }

  const questions = CHALLENGE_QUESTIONS[minPerspective];
  const question = questions[Math.floor(Math.random() * questions.length)];

  // 連続して同じ視点が不足している場合のメッセージ
  const weeksLow = minValue === 0 ? "複数週連続で" : "";

  return {
    targetPerspective: minPerspective,
    question,
    reason: `${weeksLow}${PERSPECTIVE_LABELS[minPerspective]}視点が${minValue}%と低いです。${LACK_MESSAGES[minPerspective]}`,
  };
}

/**
 * チャレンジの達成状況を確認
 */
export async function checkChallengeProgress(
  weekStart: number,
  targetPerspective: Perspective
): Promise<{
  targetCount: number;
  achievedCount: number;
  isCompleted: boolean;
}> {
  // TODO: 実際のDB問い合わせ
  // perspective カラムがあれば、その週に書かれたノートの視点を集計

  return {
    targetCount: 1,
    achievedCount: 0,
    isCompleted: false,
  };
}
