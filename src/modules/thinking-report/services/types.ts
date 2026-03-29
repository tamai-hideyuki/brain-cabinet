/**
 * Thinking Report Types
 *
 * 思考成長レポートの型定義
 */

// 視点タイプ
export const PERSPECTIVES = [
  "engineer",     // 技術者: 技術的正しさ、実装詳細
  "po",           // PO: ビジネス価値、ユーザー課題
  "user",         // ユーザー: 使いやすさ、UX
  "cto",          // CTO: 技術戦略、スケーラビリティ
  "team",         // チーム: メンバー、協業
  "stakeholder",  // ステークホルダー: 経営、事業インパクト
] as const;

export type Perspective = (typeof PERSPECTIVES)[number];

// 視点のラベル（日本語）
export const PERSPECTIVE_LABELS: Record<Perspective, string> = {
  engineer: "技術者",
  po: "PO",
  user: "ユーザー",
  cto: "CTO",
  team: "チーム",
  stakeholder: "ステークホルダー",
};

// 思考フェーズ
export const THINKING_PHASES = [
  "exploration",   // 探索: 情報収集、選択肢の洗い出し
  "structuring",   // 構造化: 整理、分類、関連付け
  "implementation", // 実装: 具体的なコード・設計
  "reflection",    // 振り返り: 評価、改善
] as const;

export type ThinkingPhase = (typeof THINKING_PHASES)[number];

// 思考フェーズのラベル
export const PHASE_LABELS: Record<ThinkingPhase, string> = {
  exploration: "探索",
  structuring: "構造化",
  implementation: "実装",
  reflection: "振り返り",
};

// クラスタ成長情報
export interface ClusterGrowth {
  identityId: number;
  label: string | null;
  notesDelta: number;       // ノート数の変化
  cohesionDelta: number;    // 凝集度の変化
  currentSize: number;
  currentCohesion: number | null;
}

// イベントサマリー
export interface EventSummary {
  type: "split" | "merge" | "extinct" | "emerge" | "continue";
  count: number;
  details: Array<{
    sourceLabel?: string;
    targetLabels?: string[];
    label?: string;
  }>;
}

// 週次レポート（フェーズ1）
export interface WeeklyReport {
  // 期間
  periodStart: number;  // Unix timestamp
  periodEnd: number;

  // 森: 全体傾向
  forest: {
    // 思考フェーズ
    currentPhase: ThinkingPhase;
    phaseTransition: {
      from: ThinkingPhase | null;
      to: ThinkingPhase;
    } | null;

    // 偏りアラート
    biasAlert: {
      category: string;        // 偏っているカテゴリ
      percentage: number;      // 偏り度（%）
      message: string;         // アラートメッセージ
    } | null;

    // 空白領域
    blindSpots: Array<{
      identityLabel: string;
      daysSinceLastUpdate: number;
    }>;

    // 全体メトリクス
    totalNotes: number;
    notesAdded: number;
    avgCohesion: number | null;
    changeScore: number | null;
  };

  // 木: 詳細
  trees: {
    // 最も成長したクラスタ
    topGrowth: ClusterGrowth[];

    // イベントサマリー
    events: EventSummary[];

    // 新しく生まれた思考
    newThoughts: Array<{
      identityId: number;
      label: string | null;
      size: number;
    }>;

    // 収束した思考
    extinctThoughts: Array<{
      label: string | null;
      absorbedBy: string | null;
    }>;
  };

  // フェーズ1.5: 他者視点からの問い
  perspectiveQuestions: Array<{
    perspective: Perspective;
    question: string;
  }>;

  // フェーズ2: 視点分布
  perspectiveDistribution: Record<Perspective, number> | null;

  // フェーズ2.5: 週次チャレンジ
  weeklyChallenge: {
    targetPerspective: Perspective;
    question: string;
    reason: string;
  } | null;
}

// 視点チャレンジ達成状況
export interface ChallengeProgress {
  weekStart: number;
  targetPerspective: Perspective;
  targetCount: number;
  achievedCount: number;
  isCompleted: boolean;
}
