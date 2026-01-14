/**
 * 苫米地式コーチング API クライアント
 */

import { sendCommand } from "./commandClient";
import type {
  CoachingPhase,
  StartSessionResult,
  RespondResult,
  EndSessionResult,
  ActiveSessionResult,
  SessionDetailResult,
  SessionHistoryResult,
} from "../types/coaching";

/**
 * 新規セッションを開始
 */
export const startSession = async (
  phase?: CoachingPhase
): Promise<StartSessionResult> => {
  return sendCommand<StartSessionResult>("coaching.start", { phase });
};

/**
 * ユーザーの応答を送信
 */
export const respond = async (
  sessionId: string,
  message: string
): Promise<RespondResult> => {
  return sendCommand<RespondResult>("coaching.respond", { sessionId, message });
};

/**
 * コーチの応答を保存
 * (GPT呼び出し後に使用)
 */
export const saveCoachResponse = async (
  sessionId: string,
  coachMessage: string,
  promptType?: string
): Promise<{ success: boolean; message: string }> => {
  return sendCommand<{ success: boolean; message: string }>(
    "coaching.saveResponse",
    { sessionId, coachMessage, promptType }
  );
};

/**
 * フェーズを遷移
 */
export const transitionPhase = async (
  sessionId: string,
  phase: CoachingPhase
): Promise<StartSessionResult> => {
  return sendCommand<StartSessionResult>("coaching.transition", {
    sessionId,
    phase,
  });
};

/**
 * セッションを終了
 */
export const endSession = async (
  sessionId: string
): Promise<EndSessionResult> => {
  return sendCommand<EndSessionResult>("coaching.end", { sessionId });
};

/**
 * アクティブなセッションを取得
 */
export const getActiveSession = async (): Promise<ActiveSessionResult> => {
  return sendCommand<ActiveSessionResult>("coaching.active");
};

/**
 * セッション詳細を取得
 */
export const getSessionDetail = async (
  sessionId: string
): Promise<SessionDetailResult> => {
  return sendCommand<SessionDetailResult>("coaching.detail", { sessionId });
};

/**
 * セッション履歴を取得
 */
export const getSessionHistory = async (
  limit?: number
): Promise<SessionHistoryResult> => {
  return sendCommand<SessionHistoryResult>("coaching.history", { limit });
};

/**
 * エクスポート結果の型
 */
export type ExportResult = {
  content: string;
  mimeType: string;
  filename: string;
  format: "markdown" | "json" | "text";
};

/**
 * セッションをエクスポート
 */
export const exportSession = async (
  sessionId: string,
  format: "markdown" | "json" | "text" = "markdown"
): Promise<ExportResult> => {
  return sendCommand<ExportResult>("coaching.export", { sessionId, format });
};

/**
 * エクスポートしたコンテンツをダウンロード
 */
export const downloadExport = async (
  sessionId: string,
  format: "markdown" | "json" | "text" = "markdown"
): Promise<void> => {
  const result = await exportSession(sessionId, format);

  const blob = new Blob([result.content], { type: result.mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
