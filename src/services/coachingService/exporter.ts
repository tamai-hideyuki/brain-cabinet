/**
 * 苫米地式コーチング - セッションエクスポート
 */

import type { CoachingInsights, CoachingPhase } from "../../db/schema";

type ExportMessage = {
  role: "coach" | "user";
  content: string;
  phase: CoachingPhase;
  turn: number;
  createdAt: number;
};

type ExportSession = {
  id: string;
  status: string;
  totalTurns: number;
  startedAt: number;
  completedAt: number | null;
  insights: CoachingInsights | null;
};

const PHASE_LABELS: Record<CoachingPhase, string> = {
  goal_setting: "ゴール設定",
  abstraction: "抽象度操作",
  self_talk: "セルフトーク改善",
  integration: "統合・振り返り",
};

/**
 * 日付をフォーマット
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * セッションをMarkdown形式でエクスポート
 */
export const exportToMarkdown = (
  session: ExportSession,
  messages: ExportMessage[]
): string => {
  let md = `# 苫米地式コーチングセッション\n\n`;
  md += `**日時**: ${formatDate(session.startedAt)}\n`;
  md += `**ターン数**: ${session.totalTurns}\n`;
  md += `**ステータス**: ${session.status === "completed" ? "完了" : session.status}\n\n`;
  md += `---\n\n`;

  // フェーズごとにグループ化
  let currentPhase: CoachingPhase | null = null;

  for (const message of messages) {
    // フェーズが変わったら見出しを追加
    if (message.phase !== currentPhase) {
      currentPhase = message.phase;
      md += `\n## ${PHASE_LABELS[currentPhase]}\n\n`;
    }

    const roleLabel = message.role === "coach" ? "**コーチ**" : "**あなた**";
    md += `${roleLabel}:\n`;
    md += `${message.content}\n\n`;
  }

  // インサイト
  if (session.insights) {
    md += `---\n\n`;
    md += `## セッションのインサイト\n\n`;

    if (session.insights.goals.length > 0) {
      md += `### 見つけたゴール\n\n`;
      for (const goal of session.insights.goals) {
        md += `- ${goal.content}\n`;
      }
      md += `\n`;
    }

    if (session.insights.scotomas.length > 0) {
      md += `### 気づいたスコトーマ（盲点）\n\n`;
      for (const scotoma of session.insights.scotomas) {
        md += `- ${scotoma.content}\n`;
      }
      md += `\n`;
    }

    if (session.insights.affirmations.length > 0) {
      md += `### 作成したアファメーション\n\n`;
      for (const affirmation of session.insights.affirmations) {
        md += `- ${affirmation.content}\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n\n`;
  md += `*エクスポート日時: ${formatDate(Math.floor(Date.now() / 1000))}*\n`;

  return md;
};

/**
 * セッションをJSON形式でエクスポート
 */
export const exportToJson = (
  session: ExportSession,
  messages: ExportMessage[]
): string => {
  const exportData = {
    session: {
      id: session.id,
      status: session.status,
      totalTurns: session.totalTurns,
      startedAt: formatDate(session.startedAt),
      completedAt: session.completedAt
        ? formatDate(session.completedAt)
        : null,
    },
    messages: messages.map((m) => ({
      role: m.role,
      phase: m.phase,
      phaseLabel: PHASE_LABELS[m.phase],
      content: m.content,
      turn: m.turn,
    })),
    insights: session.insights
      ? {
          goals: session.insights.goals.map((g) => g.content),
          scotomas: session.insights.scotomas.map((s) => s.content),
          affirmations: session.insights.affirmations.map((a) => a.content),
        }
      : null,
    exportedAt: formatDate(Math.floor(Date.now() / 1000)),
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * セッションをプレーンテキスト形式でエクスポート
 */
export const exportToText = (
  session: ExportSession,
  messages: ExportMessage[]
): string => {
  let text = `苫米地式コーチングセッション\n`;
  text += `${"=".repeat(40)}\n\n`;
  text += `日時: ${formatDate(session.startedAt)}\n`;
  text += `ターン数: ${session.totalTurns}\n\n`;
  text += `${"-".repeat(40)}\n\n`;

  let currentPhase: CoachingPhase | null = null;

  for (const message of messages) {
    if (message.phase !== currentPhase) {
      currentPhase = message.phase;
      text += `\n【${PHASE_LABELS[currentPhase]}】\n\n`;
    }

    const roleLabel = message.role === "coach" ? "コーチ" : "あなた";
    text += `[${roleLabel}]\n`;
    text += `${message.content}\n\n`;
  }

  if (session.insights) {
    text += `${"-".repeat(40)}\n\n`;
    text += `【セッションのインサイト】\n\n`;

    if (session.insights.goals.length > 0) {
      text += `■ 見つけたゴール\n`;
      for (const goal of session.insights.goals) {
        text += `  ・${goal.content}\n`;
      }
      text += `\n`;
    }

    if (session.insights.scotomas.length > 0) {
      text += `■ 気づいたスコトーマ（盲点）\n`;
      for (const scotoma of session.insights.scotomas) {
        text += `  ・${scotoma.content}\n`;
      }
      text += `\n`;
    }

    if (session.insights.affirmations.length > 0) {
      text += `■ 作成したアファメーション\n`;
      for (const affirmation of session.insights.affirmations) {
        text += `  ・${affirmation.content}\n`;
      }
      text += `\n`;
    }
  }

  return text;
};
