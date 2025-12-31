/**
 * LLM推論用プロンプト
 *
 * ノート分類のためのシステムプロンプトとユーザープロンプトを生成
 */

import { CONTEXT_HARD_LIMIT } from "./types";

// ============================================================
// システムプロンプト
// ============================================================

const SYSTEM_PROMPT = `あなたはノート分類の専門家です。ユーザーのノートを分析し、以下のJSON形式で分類結果を出力してください。

## 分類ルール

### type（ノートの種類）
- decision: 判断・決定（「〜にした」「〜を採用」「〜と判断」など）
- learning: 学習・知識（概念説明、ベストプラクティス、パターン）
- scratch: 未整理・検討中（「迷い」「TODO」「後で」など）
- emotion: 感情・内省（疲れ、不安、嬉しいなど）
- log: 記録・ログ（時刻、完了報告、MTGメモ）

### intent（意図・文脈）
- architecture: アーキテクチャ・構造設計
- design: UI/UX・仕様設計
- implementation: 実装・コーディング
- review: レビュー・フィードバック
- process: プロセス・習慣・進め方
- people: チーム・コミュニケーション
- unknown: 判定不能

### decayProfile（時間減衰プロファイル）
- stable: 長期間有効（原則、基本方針、アーキテクチャ判断）
- exploratory: 中期間有効（技術選定、設計判断）
- situational: 短期間有効（その場の判断、暫定対応）

### confidence（確信度）
0.0〜1.0の数値。判断の確かさを表す。
- 0.9以上: 明確なパターンが複数ある
- 0.7-0.9: パターンが1つ以上ある
- 0.5-0.7: 曖昧だが傾向がある
- 0.5未満: 判断が難しい

### confidenceDetail（確信度の内訳）
- structural: 構文パターンの明確さ（断定表現、比較、理由）
- semantic: 意味的な明確さ
- reasoning: 推論の論理的確かさ

## 出力形式
必ず以下のJSON形式のみを出力してください。説明文は不要です。

{
  "type": "decision",
  "intent": "architecture",
  "confidence": 0.85,
  "confidenceDetail": {
    "structural": 0.9,
    "semantic": 0.8,
    "reasoning": 0.85
  },
  "decayProfile": "stable",
  "reasoning": "「採用した」「方針として」などの判断表現があり、アーキテクチャに関する決定であるため"
}`;

// ============================================================
// プロンプト生成
// ============================================================

/**
 * 推論用プロンプトを生成
 */
export function getInferencePrompt(content: string, title: string): string {
  // コンテキスト長制限
  const truncated = content.length > CONTEXT_HARD_LIMIT;
  const processedContent = truncated
    ? content.slice(0, CONTEXT_HARD_LIMIT) + "\n\n[... 以下省略 ...]"
    : content;

  const userPrompt = `## ノート情報

### タイトル
${title}

### 本文
${processedContent}

## 指示
上記のノートを分析し、JSON形式で分類結果を出力してください。`;

  return `${SYSTEM_PROMPT}\n\n${userPrompt}`;
}

/**
 * コンテンツがトランケートされたかどうかを判定
 */
export function isContentTruncated(content: string): boolean {
  return content.length > CONTEXT_HARD_LIMIT;
}

// ============================================================
// エクスポート
// ============================================================

export { SYSTEM_PROMPT };
