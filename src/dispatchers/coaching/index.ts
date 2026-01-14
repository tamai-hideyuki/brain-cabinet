/**
 * Coaching ドメイン ディスパッチャー
 *
 * 苫米地式コーチングセッションの API ハンドラー
 */

import {
  startSession,
  respond,
  saveCoachResponse,
  transitionPhase,
  endSession,
  getActiveSession,
  getSessionDetail,
  getSessionHistory,
  getPhaseGuide,
  getNextPhase,
} from "../../services/coachingService";
import {
  exportToMarkdown,
  exportToJson,
  exportToText,
} from "../../services/coachingService/exporter";
import type { CoachingPhase } from "../../db/schema";
import { requireString } from "../../utils/validation";

// ============================================================
// Payload Types
// ============================================================

type StartPayload = {
  phase?: CoachingPhase;
};

type RespondPayload = {
  sessionId?: string;
  message?: string;
};

type SaveResponsePayload = {
  sessionId?: string;
  coachMessage?: string;
  promptType?: string;
};

type TransitionPayload = {
  sessionId?: string;
  phase?: CoachingPhase;
};

type EndPayload = {
  sessionId?: string;
};

type DetailPayload = {
  sessionId?: string;
};

type HistoryPayload = {
  limit?: number;
};

type ExportPayload = {
  sessionId?: string;
  format?: "markdown" | "json" | "text";
};

// ============================================================
// Dispatcher
// ============================================================

export const coachingDispatcher = {
  /**
   * coaching.start - 新規セッションを開始
   */
  async start(payload: unknown) {
    const p = payload as StartPayload | undefined;

    const result = await startSession(p?.phase);

    return {
      sessionId: result.sessionId,
      phase: result.phase,
      turn: result.turn,
      coachMessage: result.coachMessage,
      phaseGuide: result.phaseGuide,
      suggestedPrompt: result.suggestedPrompt,
    };
  },

  /**
   * coaching.respond - ユーザーの応答を処理
   */
  async respond(payload: unknown) {
    const p = payload as RespondPayload | undefined;
    const sessionId = requireString(p?.sessionId, "sessionId");
    const message = requireString(p?.message, "message");

    const result = await respond(sessionId, message);

    return {
      sessionId: result.sessionId,
      turn: result.turn,
      phase: result.phase,
      coachResponse: result.coachResponse,
      phaseGuide: result.phaseGuide,
      suggestedFollowUp: result.suggestedFollowUp,
      phaseProgress: result.phaseProgress,
      shouldTransition: result.shouldTransition,
      nextPhase: result.nextPhase,
    };
  },

  /**
   * coaching.saveResponse - コーチの応答を保存
   * (フロントエンドがGPTを呼び出した後に使用)
   */
  async saveResponse(payload: unknown) {
    const p = payload as SaveResponsePayload | undefined;
    const sessionId = requireString(p?.sessionId, "sessionId");
    const coachMessage = requireString(p?.coachMessage, "coachMessage");

    await saveCoachResponse(sessionId, coachMessage, p?.promptType);

    return {
      success: true,
      message: "Coach response saved",
    };
  },

  /**
   * coaching.transition - フェーズを遷移
   */
  async transition(payload: unknown) {
    const p = payload as TransitionPayload | undefined;
    const sessionId = requireString(p?.sessionId, "sessionId");

    if (!p?.phase) {
      throw new Error("phase is required");
    }

    const result = await transitionPhase(sessionId, p.phase);

    return {
      sessionId: result.sessionId,
      phase: result.phase,
      turn: result.turn,
      coachMessage: result.coachMessage,
      phaseGuide: result.phaseGuide,
      suggestedPrompt: result.suggestedPrompt,
    };
  },

  /**
   * coaching.end - セッションを終了
   */
  async end(payload: unknown) {
    const p = payload as EndPayload | undefined;
    const sessionId = requireString(p?.sessionId, "sessionId");

    const result = await endSession(sessionId);

    return {
      sessionId: result.sessionId,
      totalTurns: result.totalTurns,
      insights: result.insights,
      summary: result.summary,
    };
  },

  /**
   * coaching.active - アクティブなセッションを取得
   */
  async active(_payload: unknown) {
    const session = await getActiveSession();

    if (!session) {
      return {
        hasActiveSession: false,
        session: null,
      };
    }

    return {
      hasActiveSession: true,
      session: {
        ...session,
        phaseGuide: getPhaseGuide(session.currentPhase),
        nextPhase: getNextPhase(session.currentPhase),
      },
    };
  },

  /**
   * coaching.detail - セッション詳細を取得
   */
  async detail(payload: unknown) {
    const p = payload as DetailPayload | undefined;
    const sessionId = requireString(p?.sessionId, "sessionId");

    const result = await getSessionDetail(sessionId);

    if (!result) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return {
      session: {
        ...result.session,
        phaseGuide: getPhaseGuide(result.session.currentPhase),
        nextPhase: getNextPhase(result.session.currentPhase),
      },
      messages: result.messages,
    };
  },

  /**
   * coaching.history - 過去のセッション一覧を取得
   */
  async history(payload: unknown) {
    const p = payload as HistoryPayload | undefined;
    const limit = typeof p?.limit === "number" ? p.limit : 10;

    const sessions = await getSessionHistory(limit);

    return {
      count: sessions.length,
      sessions: sessions.map((s) => ({
        ...s,
        phaseGuide: getPhaseGuide(s.currentPhase),
      })),
    };
  },

  /**
   * coaching.export - セッションをエクスポート
   */
  async export(payload: unknown) {
    const p = payload as ExportPayload | undefined;
    const sessionId = requireString(p?.sessionId, "sessionId");
    const format = p?.format || "markdown";

    const result = await getSessionDetail(sessionId);

    if (!result) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const exportSession = {
      id: result.session.id,
      status: result.session.status,
      totalTurns: result.session.totalTurns,
      startedAt: result.session.startedAt,
      completedAt: result.session.completedAt,
      insights: result.session.insights,
    };

    const exportMessages = result.messages.map((m) => ({
      role: m.role,
      content: m.content,
      phase: m.phase,
      turn: m.turn,
      createdAt: m.createdAt,
    }));

    let content: string;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case "json":
        content = exportToJson(exportSession, exportMessages);
        mimeType = "application/json";
        filename = `coaching-session-${sessionId}.json`;
        break;
      case "text":
        content = exportToText(exportSession, exportMessages);
        mimeType = "text/plain";
        filename = `coaching-session-${sessionId}.txt`;
        break;
      case "markdown":
      default:
        content = exportToMarkdown(exportSession, exportMessages);
        mimeType = "text/markdown";
        filename = `coaching-session-${sessionId}.md`;
        break;
    }

    return {
      content,
      mimeType,
      filename,
      format,
    };
  },
};
