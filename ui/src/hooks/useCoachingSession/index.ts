/**
 * 苫米地式コーチングセッション管理フック
 */

import { useState, useCallback } from "react";
import type {
  CoachingPhase,
  CoachingSession,
  CoachingMessage,
  EndSessionResult,
} from "../../types/coaching";
import * as coachingApi from "../../api/coachingApi";

type CoachingSessionState = {
  session: CoachingSession | null;
  messages: CoachingMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  endResult: EndSessionResult | null;
};

export const useCoachingSession = () => {
  const [state, setState] = useState<CoachingSessionState>({
    session: null,
    messages: [],
    loading: false,
    sending: false,
    error: null,
    endResult: null,
  });

  /**
   * アクティブなセッションを確認
   */
  const checkActiveSession = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await coachingApi.getActiveSession();

      if (result.hasActiveSession && result.session) {
        // セッション詳細を取得
        const detail = await coachingApi.getSessionDetail(result.session.id);
        setState((prev) => ({
          ...prev,
          loading: false,
          session: detail.session,
          messages: detail.messages,
        }));
        return result.session;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        session: null,
        messages: [],
      }));
      return null;
    } catch (e) {
      const error =
        e instanceof Error ? e.message : "Failed to check active session";
      setState((prev) => ({ ...prev, loading: false, error }));
      return null;
    }
  }, []);

  /**
   * 新規セッションを開始
   */
  const start = useCallback(async (phase?: CoachingPhase) => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      session: null,
      messages: [],
      endResult: null,
    }));

    try {
      const result = await coachingApi.startSession(phase);

      // コーチの初回メッセージをメッセージリストに追加
      const coachMessage: CoachingMessage = {
        id: Date.now(),
        sessionId: result.sessionId,
        turn: result.turn,
        phase: result.phase,
        role: "coach",
        content: result.coachMessage,
        promptType: "opening",
        createdAt: Math.floor(Date.now() / 1000),
      };

      const session: CoachingSession = {
        id: result.sessionId,
        currentPhase: result.phase,
        status: "active",
        totalTurns: result.turn,
        phaseProgress: {
          goal_setting: 0,
          abstraction: 0,
          self_talk: 0,
          integration: 0,
        },
        insights: { goals: [], scotomas: [], affirmations: [] },
        startedAt: Math.floor(Date.now() / 1000),
        completedAt: null,
        lastActiveAt: Math.floor(Date.now() / 1000),
        phaseGuide: result.phaseGuide,
      };

      setState((prev) => ({
        ...prev,
        loading: false,
        session,
        messages: [coachMessage],
      }));

      return result;
    } catch (e) {
      const error =
        e instanceof Error ? e.message : "Failed to start session";
      setState((prev) => ({ ...prev, loading: false, error }));
      throw e;
    }
  }, []);

  /**
   * ユーザーメッセージを送信
   */
  const sendMessage = useCallback(
    async (message: string) => {
      if (!state.session) {
        throw new Error("No active session");
      }

      // ユーザーメッセージを即座に追加（楽観的更新）
      const userMessage: CoachingMessage = {
        id: Date.now(),
        sessionId: state.session.id,
        turn: state.session.totalTurns + 1,
        phase: state.session.currentPhase,
        role: "user",
        content: message,
        promptType: null,
        createdAt: Math.floor(Date.now() / 1000),
      };

      setState((prev) => ({
        ...prev,
        sending: true,
        error: null,
        messages: [...prev.messages, userMessage],
      }));

      try {
        const result = await coachingApi.respond(state.session.id, message);

        // コーチの応答をメッセージリストに追加
        // 注: 実際のGPT応答はフロントエンドで生成する場合は
        //     ここでresult.coachResponseを使う代わりに
        //     GPTを呼び出してから追加する
        const coachMessage: CoachingMessage = {
          id: Date.now() + 1,
          sessionId: result.sessionId,
          turn: result.turn,
          phase: result.phase,
          role: "coach",
          content: result.coachResponse,
          promptType: null,
          createdAt: Math.floor(Date.now() / 1000),
        };

        setState((prev) => ({
          ...prev,
          sending: false,
          messages: [...prev.messages, coachMessage],
          session: prev.session
            ? {
                ...prev.session,
                currentPhase: result.phase,
                totalTurns: result.turn,
                phaseProgress: {
                  ...(prev.session.phaseProgress ?? {
                    goal_setting: 0,
                    abstraction: 0,
                    self_talk: 0,
                    integration: 0,
                  }),
                  [result.phase]: result.phaseProgress,
                },
                phaseGuide: result.phaseGuide,
                nextPhase: result.nextPhase,
              }
            : null,
        }));

        return result;
      } catch (e) {
        const error =
          e instanceof Error ? e.message : "Failed to send message";
        // エラー時はユーザーメッセージを削除
        setState((prev) => ({
          ...prev,
          sending: false,
          error,
          messages: prev.messages.filter((m) => m.id !== userMessage.id),
        }));
        throw e;
      }
    },
    [state.session]
  );

  /**
   * フェーズを遷移
   */
  const transitionPhase = useCallback(
    async (phase: CoachingPhase) => {
      if (!state.session) {
        throw new Error("No active session");
      }

      setState((prev) => ({ ...prev, sending: true, error: null }));

      try {
        const result = await coachingApi.transitionPhase(
          state.session.id,
          phase
        );

        // コーチのフェーズ開始メッセージを追加
        const coachMessage: CoachingMessage = {
          id: Date.now(),
          sessionId: result.sessionId,
          turn: result.turn,
          phase: result.phase,
          role: "coach",
          content: result.coachMessage,
          promptType: "phase_transition",
          createdAt: Math.floor(Date.now() / 1000),
        };

        setState((prev) => ({
          ...prev,
          sending: false,
          messages: [...prev.messages, coachMessage],
          session: prev.session
            ? {
                ...prev.session,
                currentPhase: result.phase,
                totalTurns: result.turn,
                phaseGuide: result.phaseGuide,
              }
            : null,
        }));

        return result;
      } catch (e) {
        const error =
          e instanceof Error ? e.message : "Failed to transition phase";
        setState((prev) => ({ ...prev, sending: false, error }));
        throw e;
      }
    },
    [state.session]
  );

  /**
   * セッションを終了
   */
  const endSession = useCallback(async () => {
    if (!state.session) {
      throw new Error("No active session");
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await coachingApi.endSession(state.session.id);

      setState((prev) => ({
        ...prev,
        loading: false,
        endResult: result,
        session: prev.session
          ? { ...prev.session, status: "completed" }
          : null,
      }));

      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : "Failed to end session";
      setState((prev) => ({ ...prev, loading: false, error }));
      throw e;
    }
  }, [state.session]);

  /**
   * セッションをリセット
   */
  const reset = useCallback(() => {
    setState({
      session: null,
      messages: [],
      loading: false,
      sending: false,
      error: null,
      endResult: null,
    });
  }, []);

  return {
    // State
    session: state.session,
    messages: state.messages,
    loading: state.loading,
    sending: state.sending,
    error: state.error,
    endResult: state.endResult,

    // Actions
    checkActiveSession,
    start,
    sendMessage,
    transitionPhase,
    endSession,
    reset,
  };
};
