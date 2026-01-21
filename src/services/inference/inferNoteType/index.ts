/**
 * inferNoteType - ルールベース版
 *
 * ノートの内容から type / intent / confidence を推論する
 *
 * v4.1: confidenceDetail による信頼度分解
 *   - structural: 構文パターン（言い切り・比較・断定）
 *   - experiential: 過去判断との類似度（将来のセマンティック検索で向上）
 *   - temporal: 時間的要素（直近・繰り返し）
 *
 * v4.2: decayProfile による時間減衰
 *   - stable: 原則・アーキテクチャ判断（長寿命）
 *   - exploratory: 技術選定・試行（中寿命）
 *   - situational: その場の判断（短寿命）
 *
 * v5.0: confidence設計の改善
 *   - baseConfidence係数を修正（0.55上限問題の解消）
 *   - 0.6キャップを撤廃（0.95まで可能に）
 *   - 条件付きブーストで「誤分類しにくい0.75超え」を実現
 *   - 長文バイアス対策（パターンマッチ上限）
 */

import type { NoteType, Intent, ConfidenceDetail, DecayProfile } from "../../../db/schema";

export type InferenceResult = {
  type: NoteType;
  intent: Intent;
  confidence: number;
  confidenceDetail: ConfidenceDetail;
  decayProfile: DecayProfile;
  reasoning: string;
};

// 判断表現のパターン
const DECISION_PATTERNS = [
  /した方が良/,
  /すべき/,
  /にする$/,
  /にした$/,
  /を選ぶ/,
  /を選んだ/,
  /を採用/,
  /に決め/,
  /と判断/,
  /ことにした/,
  /方針/,
  /結論/,
  /理由.*から/,
  /なぜなら/,
  /〜だから/,
  /ため$/,
];

// 学習・知識表現のパターン
const LEARNING_PATTERNS = [
  /とは$/,
  /である$/,
  /という概念/,
  /原則/,
  /パターン/,
  /ベストプラクティス/,
  /一般的に/,
  /基本的に/,
  /〜の場合は/,
  /使い分け/,
  /違い/,
  /特徴/,
  /メリット/,
  /デメリット/,
];

// 感情表現のパターン
const EMOTION_PATTERNS = [
  /疲れ/,
  /しんどい/,
  /つらい/,
  /嬉しい/,
  /楽しい/,
  /不安/,
  /焦り/,
  /イライラ/,
  /モヤモヤ/,
  /気持ち/,
  /感情/,
  /ストレス/,
  /メンタル/,
];

// ログ・記録表現のパターン
const LOG_PATTERNS = [
  /^\d{1,2}:\d{2}/m,  // 時刻
  /完了$/,
  /実施$/,
  /対応$/,
  /MTG/,
  /ミーティング/,
  /レビュー$/,
  /確認$/,
];

// 迷い・未整理表現のパターン
const SCRATCH_PATTERNS = [
  /迷/,
  /わからない/,
  /どうしよう/,
  /かも$/,
  /かな$/,
  /？$/,
  /\?$/,
  /要検討/,
  /後で/,
  /TODO/,
  /メモ/,
];

// Intent判定用キーワード
const INTENT_KEYWORDS: Record<Intent, RegExp[]> = {
  architecture: [
    /アーキテクチャ/,
    /構造/,
    /責務/,
    /境界/,
    /レイヤ/,
    /モジュール/,
    /依存/,
    /分離/,
    /DTO/,
    /Entity/,
    /ドメイン/,
    /インフラ/,
  ],
  design: [
    /設計/,
    /UI/,
    /UX/,
    /仕様/,
    /インターフェース/,
    /API/,
    /スキーマ/,
    /モデル/,
  ],
  implementation: [
    /実装/,
    /コード/,
    /関数/,
    /クラス/,
    /メソッド/,
    /バグ/,
    /エラー/,
    /修正/,
    /リファクタ/,
  ],
  review: [
    /レビュー/,
    /PR/,
    /プルリク/,
    /コードレビュー/,
    /フィードバック/,
    /改善/,
  ],
  process: [
    /プロセス/,
    /フロー/,
    /手順/,
    /習慣/,
    /ルーティン/,
    /進め方/,
    /やり方/,
  ],
  people: [
    /チーム/,
    /メンバー/,
    /コミュニケーション/,
    /関係/,
    /1on1/,
    /マネジメント/,
  ],
  unknown: [],
};

/**
 * パターンマッチ数をカウント（長文バイアス対策で上限2）
 */
function countMatches(content: string, patterns: RegExp[]): number {
  const count = patterns.filter((p) => p.test(content)).length;
  // 長文バイアス対策: 同一カテゴリで3件以上マッチしても2扱い
  return Math.min(2, count);
}

/**
 * パターンマッチ数をカウント（上限なし版 - structural計算用）
 */
function countMatchesRaw(content: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(content)).length;
}

function detectIntent(content: string): Intent {
  let maxScore = 0;
  let detected: Intent = "unknown";

  for (const [intent, patterns] of Object.entries(INTENT_KEYWORDS)) {
    const score = countMatches(content, patterns);
    if (score > maxScore) {
      maxScore = score;
      detected = intent as Intent;
    }
  }

  return detected;
}

// ===================================================
// v4.1 構造的信頼度（structural）計算用パターン
// ===================================================

// 断定・言い切りパターン（高い structural スコア）
const ASSERTION_PATTERNS = [
  /にした$/m,
  /にする$/m,
  /を選んだ/,
  /を選ぶ/,
  /を採用/,
  /に決め/,
  /と判断/,
  /ことにした/,
  /方針.*は/,
  /結論.*は/,
];

// 比較パターン（AよりB）
const COMPARISON_PATTERNS = [
  /より.*が良/,
  /より.*を選/,
  /ではなく/,
  /の方が/,
  /と比べ/,
  /を比較/,
];

// 理由パターン（なぜなら〜）
const REASONING_PATTERNS = [
  /なぜなら/,
  /理由.*は/,
  /だから$/m,
  /ため$/m,
  /から$/m,
];

function calculateStructural(content: string): number {
  // structural計算は上限なしでカウント（より正確な構造判定のため）
  const assertionCount = countMatchesRaw(content, ASSERTION_PATTERNS);
  const comparisonCount = countMatchesRaw(content, COMPARISON_PATTERNS);
  const reasoningCount = countMatchesRaw(content, REASONING_PATTERNS);

  // 各要素を重み付けして合計（最大1.0）
  const rawScore =
    assertionCount * 0.15 +
    comparisonCount * 0.2 +
    reasoningCount * 0.1;

  return Math.min(1.0, Math.round(rawScore * 100) / 100);
}

// ===================================================
// v5.0 learning向けの構造パターン（定義・列挙・対比）
// ===================================================
const DEFINITION_PATTERNS = [/とは/, /である/, /という概念/, /要するに/];
const STRUCTURE_PATTERNS = [/^-\s/m, /^\d+\.\s/m, /^##\s/m, /^\*\s/m]; // 箇条書き・番号・見出し

// ===================================================
// v4.1 経験的信頼度（experiential）
// ===================================================
// 現在のルールベースでは常に0（将来のセマンティック検索で向上）
function calculateExperiential(): number {
  // Phase 2: 過去の decision ノートとのコサイン類似度を計算
  // 現在はプレースホルダー（0.0）
  return 0.0;
}

// ===================================================
// v4.1 時間的信頼度（temporal）
// ===================================================
// 現在のルールベースでは常に0（将来の頻度分析で向上）
function calculateTemporal(): number {
  // Phase 2: 同じ intent の判断が直近に繰り返されているかを分析
  // 現在はプレースホルダー（0.0）
  return 0.0;
}

// ===================================================
// v4.2 時間減衰プロファイル（Decay Profile）推論
// ===================================================

// 状況的判断パターン（短寿命: 半減期 ≈ 14日）
const SITUATIONAL_PATTERNS = [
  /当面は/,
  /今回は/,
  /一旦/,
  /暫定/,
  /とりあえず/,
  /今のところ/,
  /しばらく/,
  /試しに/,
];

// 安定判断パターン（長寿命: 半減期 ≈ 693日）
const STABLE_PATTERNS = [
  /原則/,
  /基本方針/,
  /常に/,
  /必ず/,
  /絶対に/,
  /ルールとして/,
  /標準として/,
  /デフォルトで/,
];

// 安定寄りの intent
const STABLE_INTENTS: Intent[] = ["architecture", "process"];
// 探索寄りの intent
const EXPLORATORY_INTENTS: Intent[] = ["implementation", "design"];

function inferDecayProfile(
  content: string,
  intent: Intent,
  confidenceDetail: ConfidenceDetail
): DecayProfile {
  // 1. 構文パターンで明示的に判定
  const hasSituational = SITUATIONAL_PATTERNS.some((p) => p.test(content));
  const hasStable = STABLE_PATTERNS.some((p) => p.test(content));

  if (hasSituational && !hasStable) return "situational";
  if (hasStable && !hasSituational) return "stable";

  // 2. Intent ベースの判定
  if (STABLE_INTENTS.includes(intent)) return "stable";
  if (EXPLORATORY_INTENTS.includes(intent)) return "exploratory";

  // 3. structural スコアで最終調整
  // 高い structural → より確信的 → stable 寄り
  if (confidenceDetail.structural >= 0.5) return "stable";
  if (confidenceDetail.structural >= 0.2) return "exploratory";

  // デフォルトは exploratory
  return "exploratory";
}

export function inferNoteType(content: string): InferenceResult {
  const decisionScore = countMatches(content, DECISION_PATTERNS);
  const learningScore = countMatches(content, LEARNING_PATTERNS);
  const emotionScore = countMatches(content, EMOTION_PATTERNS);
  const logScore = countMatches(content, LOG_PATTERNS);
  const scratchScore = countMatches(content, SCRATCH_PATTERNS);

  const scores = {
    decision: decisionScore,
    learning: learningScore,
    emotion: emotionScore,
    log: logScore,
    scratch: scratchScore,
  };

  // 最大スコアを持つタイプを選択
  const entries = Object.entries(scores) as [NoteType, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [topType, topScore] = entries[0];
  const [, secondScore] = entries[1];

  // スコアが0の場合は scratch にフォールバック
  const type: NoteType = topScore === 0 ? "scratch" : topType;

  // ===================================================
  // v4.1 confidenceDetail 計算
  // ===================================================
  const structural = calculateStructural(content);
  const experiential = calculateExperiential();
  const temporal = calculateTemporal();

  const confidenceDetail: ConfidenceDetail = {
    structural,
    experiential,
    temporal,
  };

  // ===================================================
  // v5.0 confidence 計算（改善版）
  // ===================================================
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  let baseConfidence: number;
  let dominance = 0;
  let gap = 0;

  if (totalScore === 0) {
    baseConfidence = 0.3;
  } else {
    dominance = topScore / totalScore;
    gap = (topScore - secondScore) / totalScore;
    // v5.0: 係数を修正（旧: 0.3 + 0.15 + 0.1 = 0.55上限 → 新: 0.25 + 0.45 + 0.25 = 0.95上限）
    baseConfidence = 0.25 + dominance * 0.45 + gap * 0.25;
  }

  // v5.0: structural の寄与を増加（0.1 → 0.2）
  let confidence = baseConfidence + structural * 0.2;

  // ===================================================
  // v5.0 条件付きブースト（誤分類しにくい時だけ上げる）
  // ===================================================
  const hasAssert = countMatchesRaw(content, ASSERTION_PATTERNS) > 0;
  const hasReason = countMatchesRaw(content, REASONING_PATTERNS) > 0;
  const hasCompare = countMatchesRaw(content, COMPARISON_PATTERNS) > 0;
  const hasDefinition = countMatchesRaw(content, DEFINITION_PATTERNS) > 0;
  const hasStructure = countMatchesRaw(content, STRUCTURE_PATTERNS) > 0;

  // log: 強いルールがあれば一気に0.85まで上げる（誤分類しにくい）
  if (type === "log" && logScore >= 2) {
    confidence = Math.max(confidence, 0.85);
  }

  // decision: 複合条件で0.75超えを狙う
  if (type === "decision" && dominance >= 0.65 && gap >= 0.25 && hasAssert && (hasReason || hasCompare)) {
    confidence += 0.18;
  }

  // learning: 定義 + 構造化で0.75超えを狙う
  if (type === "learning" && dominance >= 0.6 && gap >= 0.2 && hasDefinition && (hasStructure || hasCompare)) {
    confidence += 0.18;
  }

  // v5.0: キャップを0.95に変更（旧: 0.6）
  confidence = Math.min(0.95, confidence);

  // intent 推論
  const intent = detectIntent(content);

  // ===================================================
  // v4.2 decayProfile 計算
  // ===================================================
  const decayProfile = inferDecayProfile(content, intent, confidenceDetail);

  // reasoning 生成
  const matchedPatterns: string[] = [];
  if (decisionScore > 0) matchedPatterns.push(`判断表現(${decisionScore})`);
  if (learningScore > 0) matchedPatterns.push(`学習表現(${learningScore})`);
  if (emotionScore > 0) matchedPatterns.push(`感情表現(${emotionScore})`);
  if (logScore > 0) matchedPatterns.push(`記録表現(${logScore})`);
  if (scratchScore > 0) matchedPatterns.push(`未整理表現(${scratchScore})`);

  const reasoning =
    matchedPatterns.length > 0
      ? `検出: ${matchedPatterns.join(", ")}`
      : "パターン検出なし（デフォルト: scratch）";

  return {
    type,
    intent,
    confidence: Math.round(confidence * 100) / 100,
    confidenceDetail,
    decayProfile,
    reasoning,
  };
}
