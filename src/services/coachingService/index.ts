/**
 * 苫米地式コーチングサービス
 */

import type { CoachingPhase, CoachingInsights } from "../../db/schema";
import * as coachingRepo from "../../repositories/coachingRepo";
import {
  PHASE_GUIDES,
  getProgressGuide,
  type StartSessionResult,
  type RespondResult,
  type EndSessionResult,
} from "./types";
import {
  getPhaseOpeningMessage,
  getPhaseGuide,
  getNextPhase,
  shouldSuggestTransition,
  calculatePhaseProgress,
  generatePrompt,
  createEmptyInsights,
  calculateTurnInPhase,
} from "./sessionManager";
import { generateSessionSummary } from "./prompts";
import { extractInsights, mergeInsights } from "./insightExtractor";
import {
  generateCoachResponseWithOllama,
  isOllamaAvailableForCoaching,
} from "./ollamaCoach";
import { logger } from "../../utils/logger";

export * from "./types";
export { extractInsights } from "./insightExtractor";
export { generatePrompt, getPhaseGuide, getNextPhase } from "./sessionManager";

/**
 * 新規セッションを開始
 */
export const startSession = async (
  initialPhase?: CoachingPhase
): Promise<StartSessionResult> => {
  // セッションを作成
  const session = await coachingRepo.createSession({
    initialPhase: initialPhase ?? "goal_setting",
  });

  // 開始メッセージを取得
  const coachMessage = getPhaseOpeningMessage(session.currentPhase);
  const phaseGuide = getPhaseGuide(session.currentPhase);

  // コーチのメッセージを保存
  await coachingRepo.addMessage({
    sessionId: session.id,
    turn: 1,
    phase: session.currentPhase,
    role: "coach",
    content: coachMessage,
    promptType: "opening",
  });

  // ターン数を更新
  await coachingRepo.updateSession(session.id, { totalTurns: 1 });

  // プロンプトを生成（GPT呼び出し用）
  const { systemPrompt } = generatePrompt({
    sessionId: session.id,
    phase: session.currentPhase,
    turn: 1,
    history: [],
  });

  return {
    sessionId: session.id,
    phase: session.currentPhase,
    turn: 1,
    coachMessage,
    phaseGuide,
    suggestedPrompt: systemPrompt,
  };
};

/**
 * ユーザーの応答を処理し、コーチの応答を生成
 */
export const respond = async (
  sessionId: string,
  userMessage: string
): Promise<RespondResult> => {
  // セッションを取得
  const session = await coachingRepo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status !== "active") {
    throw new Error(`Session is not active: ${session.status}`);
  }

  // メッセージ履歴を取得
  const messages = await coachingRepo.getMessages(sessionId);

  // ユーザーメッセージを保存
  const newTurn = session.totalTurns + 1;
  await coachingRepo.addMessage({
    sessionId,
    turn: newTurn,
    phase: session.currentPhase,
    role: "user",
    content: userMessage,
  });

  // 履歴を構築
  const history = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // コーチの応答を生成
  let coachResponse: string;
  let usedOllama = false;

  // Ollama が利用可能か確認
  const ollamaAvailable = await isOllamaAvailableForCoaching();

  if (ollamaAvailable) {
    // Ollama で応答生成
    try {
      const ollamaResult = await generateCoachResponseWithOllama({
        phase: session.currentPhase,
        history,
        userMessage,
      });
      coachResponse = ollamaResult.content;
      usedOllama = true;
      logger.info({ sessionId, phase: session.currentPhase, model: ollamaResult.model }, "Coach response generated with Ollama");
    } catch (error) {
      logger.warn({ sessionId, error }, "Ollama failed, falling back to template");
      // フォールバック: テンプレートベース
      const promptOutput = generatePrompt({
        sessionId,
        phase: session.currentPhase,
        turn: newTurn,
        history,
        userMessage,
      });
      coachResponse = promptOutput.userPrompt;
    }
  } else {
    // Ollama 利用不可: テンプレートベース
    logger.debug({ sessionId }, "Ollama not available, using template-based response");
    const promptOutput = generatePrompt({
      sessionId,
      phase: session.currentPhase,
      turn: newTurn,
      history,
      userMessage,
    });
    coachResponse = promptOutput.userPrompt;
  }

  // コーチの応答を保存
  await coachingRepo.addMessage({
    sessionId,
    turn: newTurn,
    phase: session.currentPhase,
    role: "coach",
    content: coachResponse,
    promptType: usedOllama ? "ollama" : "template",
  });

  // フェーズ内のターン数を計算
  const turnInPhase = calculateTurnInPhase(
    [...messages, { phase: session.currentPhase, role: "user" as const }],
    session.currentPhase
  );

  // フェーズ進捗を計算
  const phaseProgress = calculatePhaseProgress(
    session.currentPhase,
    turnInPhase
  );

  // フェーズ遷移を提案すべきか判定（会話履歴も考慮）
  const shouldTransition = shouldSuggestTransition(
    session.currentPhase,
    turnInPhase,
    phaseProgress,
    history
  );
  const nextPhase = shouldTransition
    ? getNextPhase(session.currentPhase)
    : null;

  // セッションを更新
  const updatedProgress = {
    ...(session.phaseProgress ?? {
      goal_setting: 0,
      abstraction: 0,
      self_talk: 0,
      integration: 0,
    }),
    [session.currentPhase]: phaseProgress,
  };

  await coachingRepo.updateSession(sessionId, {
    totalTurns: newTurn,
    phaseProgress: updatedProgress,
  });

  // 進捗に応じたガイドメッセージ
  const phaseGuide = getProgressGuide(session.currentPhase, phaseProgress);

  return {
    sessionId,
    turn: newTurn,
    phase: session.currentPhase,
    coachResponse,
    phaseGuide,
    suggestedFollowUp: [], // 将来的に追加
    phaseProgress,
    shouldTransition,
    nextPhase: nextPhase ?? undefined,
  };
};

/**
 * コーチの応答を保存
 * (フロントエンドがGPTを呼び出した後に使用)
 */
export const saveCoachResponse = async (
  sessionId: string,
  coachMessage: string,
  promptType?: string
): Promise<void> => {
  const session = await coachingRepo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  await coachingRepo.addMessage({
    sessionId,
    turn: session.totalTurns,
    phase: session.currentPhase,
    role: "coach",
    content: coachMessage,
    promptType,
  });
};

/**
 * フェーズを遷移
 */
export const transitionPhase = async (
  sessionId: string,
  targetPhase: CoachingPhase
): Promise<StartSessionResult> => {
  const session = await coachingRepo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // フェーズを更新
  await coachingRepo.updateSession(sessionId, {
    currentPhase: targetPhase,
  });

  // 新フェーズの開始メッセージを取得
  const coachMessage = getPhaseOpeningMessage(targetPhase);
  const phaseGuide = getPhaseGuide(targetPhase);

  // コーチのメッセージを保存
  const newTurn = session.totalTurns + 1;
  await coachingRepo.addMessage({
    sessionId,
    turn: newTurn,
    phase: targetPhase,
    role: "coach",
    content: coachMessage,
    promptType: "phase_transition",
  });

  await coachingRepo.updateSession(sessionId, { totalTurns: newTurn });

  // プロンプトを生成
  const messages = await coachingRepo.getMessages(sessionId);
  const history = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const { systemPrompt } = generatePrompt({
    sessionId,
    phase: targetPhase,
    turn: newTurn,
    history,
  });

  return {
    sessionId,
    phase: targetPhase,
    turn: newTurn,
    coachMessage,
    phaseGuide,
    suggestedPrompt: systemPrompt,
  };
};

/**
 * セッションを終了
 */
export const endSession = async (
  sessionId: string
): Promise<EndSessionResult> => {
  const session = await coachingRepo.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // メッセージ履歴を取得してインサイトを抽出
  const messages = await coachingRepo.getMessages(sessionId);
  const messagesForExtraction = messages.map((m) => ({
    role: m.role,
    content: m.content,
    phase: m.phase,
    turn: m.turn,
  }));

  // インサイトを抽出
  const extractedInsights = extractInsights(messagesForExtraction);

  // 既存のインサイトとマージ
  const existingInsights = session.insights ?? createEmptyInsights();
  const insights = mergeInsights(existingInsights, extractedInsights);

  // インサイトを保存
  await coachingRepo.updateSession(sessionId, { insights });

  // セッションを終了
  await coachingRepo.endSession(sessionId, "completed");

  // サマリーを生成
  const summary = generateSessionSummary(
    insights.goals.map((g) => g.content),
    insights.scotomas.map((s) => s.content),
    insights.affirmations.map((a) => a.content)
  );

  return {
    sessionId,
    totalTurns: session.totalTurns,
    insights,
    summary,
  };
};

/**
 * アクティブなセッションを取得
 */
export const getActiveSession = async () => {
  return coachingRepo.getActiveSession();
};

/**
 * セッション詳細を取得
 */
export const getSessionDetail = async (sessionId: string) => {
  return coachingRepo.getSessionWithMessages(sessionId);
};

/**
 * セッション履歴を取得
 */
export const getSessionHistory = async (limit?: number) => {
  return coachingRepo.getSessionHistory(limit);
};
