/**
 * 苫米地式コーチング - フロントエンド型定義
 */

// フェーズ
export type CoachingPhase =
  | "goal_setting"
  | "abstraction"
  | "self_talk"
  | "integration";

// セッションステータス
export type CoachingStatus = "active" | "completed" | "abandoned";

// メッセージ
export type CoachingMessage = {
  id: number;
  sessionId: string;
  turn: number;
  phase: CoachingPhase;
  role: "coach" | "user";
  content: string;
  promptType: string | null;
  createdAt: number;
};

// インサイト
export type CoachingInsights = {
  goals: Array<{
    content: string;
    isOutsideCurrentState: boolean;
    wantToScore: number;
  }>;
  scotomas: Array<{
    content: string;
    discoveredAt: number;
  }>;
  affirmations: Array<{
    content: string;
    efficacyLevel: number;
  }>;
};

// フェーズ進捗
export type PhaseProgress = Record<CoachingPhase, number>;

// セッション
export type CoachingSession = {
  id: string;
  currentPhase: CoachingPhase;
  status: CoachingStatus;
  totalTurns: number;
  phaseProgress: PhaseProgress | null;
  insights: CoachingInsights | null;
  startedAt: number;
  completedAt: number | null;
  lastActiveAt: number;
  phaseGuide?: string;
  nextPhase?: CoachingPhase | null;
};

// API レスポンス型

export type StartSessionResult = {
  sessionId: string;
  phase: CoachingPhase;
  turn: number;
  coachMessage: string;
  phaseGuide: string;
  suggestedPrompt: string;
};

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

export type EndSessionResult = {
  sessionId: string;
  totalTurns: number;
  insights: CoachingInsights;
  summary: string;
};

export type ActiveSessionResult = {
  hasActiveSession: boolean;
  session: CoachingSession | null;
};

export type SessionDetailResult = {
  session: CoachingSession;
  messages: CoachingMessage[];
};

export type SessionHistoryResult = {
  count: number;
  sessions: CoachingSession[];
};
