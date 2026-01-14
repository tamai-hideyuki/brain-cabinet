/**
 * 苫米地式コーチングサービス - 型定義
 */

import type { CoachingPhase, CoachingInsights } from "../../db/schema";

// FSM フェーズ遷移定義
export const PHASE_TRANSITIONS: Record<CoachingPhase, CoachingPhase[]> = {
  goal_setting: ["abstraction"],
  abstraction: ["self_talk"],
  self_talk: ["integration"],
  integration: [], // completed
};

// フェーズごとのガイドメッセージ（メイン）
export const PHASE_GUIDES: Record<CoachingPhase, string> = {
  goal_setting: "今は、あなたが本当に望むゴールを一緒に探っていきましょう",
  abstraction: "視点を上げて、新しい可能性を見つけていきましょう",
  self_talk: "普段の自分への語りかけを見つめ直してみましょう",
  integration: "セッション全体を振り返り、気づきを整理しましょう",
};

// フェーズごとの進捗に応じたガイドメッセージ
export const PHASE_PROGRESS_GUIDES: Record<CoachingPhase, Record<string, string>> = {
  goal_setting: {
    early: "焦らず、本当に望むことを探っていきましょう",
    middle: "「やりたい」と「やらなければ」を区別してみましょう",
    late: "ゴールの姿が見えてきましたね",
  },
  abstraction: {
    early: "一段高いところから眺めてみましょう",
    middle: "見落としていることはないでしょうか",
    late: "新しい視点が見えてきたようですね",
  },
  self_talk: {
    early: "普段、自分にどんな言葉をかけていますか",
    middle: "その言葉を、もっと力が湧く表現に変えてみましょう",
    late: "あなたのアファメーションを作っていきましょう",
  },
  integration: {
    early: "今日の対話を振り返ってみましょう",
    middle: "気づきを言葉にしてみましょう",
    late: "明日からの一歩を考えましょう",
  },
};

/**
 * 進捗に応じたガイドメッセージを取得
 */
export const getProgressGuide = (
  phase: CoachingPhase,
  progress: number
): string => {
  const guides = PHASE_PROGRESS_GUIDES[phase];
  if (progress < 0.3) {
    return guides.early;
  } else if (progress < 0.7) {
    return guides.middle;
  } else {
    return guides.late;
  }
};

// セッション開始レスポンス
export type StartSessionResult = {
  sessionId: string;
  phase: CoachingPhase;
  turn: number;
  coachMessage: string;
  phaseGuide: string;
  suggestedPrompt: string;
};

// ユーザー応答レスポンス
export type RespondResult = {
  sessionId: string;
  turn: number;
  phase: CoachingPhase;
  coachResponse: string;
  phaseGuide: string;
  suggestedFollowUp: string[];
  phaseProgress: number;
  shouldTransition: boolean;
  nextPhase?: CoachingPhase;
};

// セッション終了レスポンス
export type EndSessionResult = {
  sessionId: string;
  totalTurns: number;
  insights: CoachingInsights;
  summary: string;
};

// プロンプト生成入力
export type GeneratePromptInput = {
  sessionId: string;
  phase: CoachingPhase;
  turn: number;
  history: Array<{ role: "coach" | "user"; content: string }>;
  userMessage?: string;
};

// プロンプト生成出力
export type GeneratePromptOutput = {
  systemPrompt: string;
  userPrompt: string;
  context: string;
  promptType: string;
};
