/**
 * 苫米地式コーチング - セッション管理（FSM）
 */

import type { CoachingPhase, CoachingInsights } from "../../db/schema";
import {
  PHASE_TRANSITIONS,
  PHASE_GUIDES,
  type GeneratePromptInput,
  type GeneratePromptOutput,
} from "./types";
import {
  getSystemPromptWithPhase,
  GOAL_SETTING_OPENING,
  ABSTRACTION_OPENING,
  SELF_TALK_OPENING,
  INTEGRATION_OPENING,
  generateGoalSettingPrompt,
  generateAbstractionPrompt,
  generateSelfTalkPrompt,
  generateIntegrationPrompt,
} from "./prompts";

// フェーズごとの開始メッセージ
const PHASE_OPENING_MESSAGES: Record<CoachingPhase, string> = {
  goal_setting: GOAL_SETTING_OPENING,
  abstraction: ABSTRACTION_OPENING,
  self_talk: SELF_TALK_OPENING,
  integration: INTEGRATION_OPENING,
};

/**
 * フェーズの開始メッセージを取得
 */
export const getPhaseOpeningMessage = (phase: CoachingPhase): string => {
  return PHASE_OPENING_MESSAGES[phase];
};

/**
 * フェーズのガイドメッセージを取得
 */
export const getPhaseGuide = (phase: CoachingPhase): string => {
  return PHASE_GUIDES[phase];
};

/**
 * 次のフェーズへ遷移可能かチェック
 */
export const canTransition = (
  currentPhase: CoachingPhase,
  targetPhase: CoachingPhase
): boolean => {
  const allowedTransitions = PHASE_TRANSITIONS[currentPhase];
  return allowedTransitions.includes(targetPhase);
};

/**
 * 次のフェーズを取得（遷移可能な場合）
 */
export const getNextPhase = (
  currentPhase: CoachingPhase
): CoachingPhase | null => {
  const allowedTransitions = PHASE_TRANSITIONS[currentPhase];
  return allowedTransitions.length > 0 ? allowedTransitions[0] : null;
};

/**
 * フェーズ遷移の準備度を評価
 */
export type TransitionReadiness = {
  ready: boolean;
  reason: string;
  confidence: number; // 0.0 - 1.0
};

/**
 * フェーズ遷移を提案すべきかを判定
 * ターン数、フェーズ進捗、会話内容に基づく
 */
export const shouldSuggestTransition = (
  phase: CoachingPhase,
  turnInPhase: number,
  phaseProgress: number,
  history?: Array<{ role: "coach" | "user"; content: string }>
): boolean => {
  const readiness = evaluateTransitionReadiness(phase, turnInPhase, phaseProgress, history);
  return readiness.ready;
};

/**
 * 遷移準備度を詳細に評価
 */
export const evaluateTransitionReadiness = (
  phase: CoachingPhase,
  turnInPhase: number,
  phaseProgress: number,
  history?: Array<{ role: "coach" | "user"; content: string }>
): TransitionReadiness => {
  // フェーズごとの最小ターン数
  const minTurnsPerPhase: Record<CoachingPhase, number> = {
    goal_setting: 4,
    abstraction: 4,
    self_talk: 5,
    integration: 3,
  };

  const minTurns = minTurnsPerPhase[phase];

  // 最小ターン数に達していない場合
  if (turnInPhase < minTurns) {
    return {
      ready: false,
      reason: `まだ${phase}フェーズを深めている最中です`,
      confidence: turnInPhase / minTurns,
    };
  }

  // 会話内容からフェーズ完了の兆候を検出
  if (history && history.length > 0) {
    const recentMessages = history.slice(-4).filter((m) => m.role === "user");
    const lastMessage = recentMessages[recentMessages.length - 1]?.content || "";

    // フェーズごとの完了兆候
    const completionSignals = getPhaseCompletionSignals(phase);
    const hasCompletionSignal = completionSignals.some((signal) =>
      lastMessage.includes(signal)
    );

    if (hasCompletionSignal) {
      return {
        ready: true,
        reason: "フェーズの目的が達成されたようです",
        confidence: 0.9,
      };
    }
  }

  // 進捗が80%以上の場合
  if (phaseProgress >= 0.8) {
    return {
      ready: true,
      reason: "十分な対話ができました",
      confidence: phaseProgress,
    };
  }

  // 最大ターン数に達した場合
  const maxTurns = 8;
  if (turnInPhase >= maxTurns) {
    return {
      ready: true,
      reason: "次のフェーズに進む時期です",
      confidence: 0.7,
    };
  }

  return {
    ready: false,
    reason: "まだ探求を続けましょう",
    confidence: phaseProgress,
  };
};

/**
 * フェーズごとの完了兆候キーワード
 */
const getPhaseCompletionSignals = (phase: CoachingPhase): string[] => {
  switch (phase) {
    case "goal_setting":
      return [
        "これがゴール",
        "決まった",
        "見つかった",
        "これだ",
        "やりたいこと",
        "明確に",
        "はっきり",
      ];
    case "abstraction":
      return [
        "見えてきた",
        "気づいた",
        "わかった",
        "そうか",
        "新しい視点",
        "盲点だった",
        "スコトーマ",
      ];
    case "self_talk":
      return [
        "私は",
        "宣言",
        "アファメーション",
        "変えていく",
        "言い換え",
        "できる",
        "自信",
      ];
    case "integration":
      return [
        "ありがとう",
        "よかった",
        "すっきり",
        "整理できた",
        "明日から",
        "始める",
      ];
  }
};

/**
 * フェーズ進捗を計算
 * ターン数に基づく単純な計算（将来的にはより高度な分析を追加）
 */
export const calculatePhaseProgress = (
  phase: CoachingPhase,
  turnInPhase: number
): number => {
  // 各フェーズは約7ターンで完了と仮定
  const expectedTurns = 7;
  const progress = Math.min(turnInPhase / expectedTurns, 1.0);
  return Math.round(progress * 100) / 100;
};

/**
 * プロンプトを生成
 */
export const generatePrompt = (
  input: GeneratePromptInput
): GeneratePromptOutput => {
  const { phase, turn, history, userMessage } = input;

  // システムプロンプトを取得
  const systemPrompt = getSystemPromptWithPhase(phase);

  // 会話履歴をコンテキストに変換
  const context = history
    .map(
      (m) =>
        `${m.role === "coach" ? "コーチ" : "クライアント"}: ${m.content}`
    )
    .join("\n");

  // フェーズに応じたユーザープロンプトを生成
  let userPrompt: string;
  let promptType: string;

  if (!userMessage) {
    // 初回またはフェーズ開始時
    userPrompt = getPhaseOpeningMessage(phase);
    promptType = "opening";
  } else {
    // 通常の応答生成
    switch (phase) {
      case "goal_setting":
        userPrompt = generateGoalSettingPrompt(turn, history, userMessage);
        promptType = "goal_setting_response";
        break;
      case "abstraction":
        userPrompt = generateAbstractionPrompt(turn, history, userMessage);
        promptType = "abstraction_response";
        break;
      case "self_talk":
        userPrompt = generateSelfTalkPrompt(turn, history, userMessage);
        promptType = "self_talk_response";
        break;
      case "integration":
        userPrompt = generateIntegrationPrompt(turn, history, userMessage);
        promptType = "integration_response";
        break;
      default:
        userPrompt = userMessage;
        promptType = "unknown";
    }
  }

  return {
    systemPrompt,
    userPrompt,
    context,
    promptType,
  };
};

/**
 * 空のインサイトを作成
 */
export const createEmptyInsights = (): CoachingInsights => ({
  goals: [],
  scotomas: [],
  affirmations: [],
});

/**
 * インサイトを更新
 */
export const updateInsights = (
  current: CoachingInsights,
  extracted: Partial<CoachingInsights>
): CoachingInsights => {
  return {
    goals: [...current.goals, ...(extracted.goals ?? [])],
    scotomas: [...current.scotomas, ...(extracted.scotomas ?? [])],
    affirmations: [
      ...current.affirmations,
      ...(extracted.affirmations ?? []),
    ],
  };
};

/**
 * フェーズ内のターン数を計算
 */
export const calculateTurnInPhase = (
  messages: Array<{ phase: CoachingPhase; role: "coach" | "user" }>,
  currentPhase: CoachingPhase
): number => {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].phase === currentPhase) {
      if (messages[i].role === "user") {
        count++;
      }
    } else {
      break;
    }
  }
  return count;
};
