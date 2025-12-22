/**
 * Question Generator Service
 *
 * ノート内容から Active Recall 質問を生成する
 * - テンプレートベース生成（高速・確実）
 * - 将来的にLLM生成も追加可能
 */

import type {
  RecallQuestionType,
  QuestionSource,
  NoteType,
} from "../../../db/schema";
import type { CreateQuestionInput } from "../../../repositories/reviewRepo";
import { createHash } from "crypto";

// ============================================================
// Types
// ============================================================

export interface GeneratedQuestion {
  type: RecallQuestionType;
  question: string;
  expectedKeywords: string[];
  source: QuestionSource;
}

// ============================================================
// Template Definitions
// ============================================================

const TEMPLATES: Record<RecallQuestionType, string[]> = {
  recall: [
    "このノートの主なポイントを3つ挙げてください。",
    "このノートで学んだ最も重要なことは何ですか？",
    "このノートの内容を一言で要約してください。",
  ],
  concept: [
    "「{topic}」とは何ですか？",
    "「{topic}」の定義を説明してください。",
    "「{topic}」の主な特徴は何ですか？",
  ],
  reasoning: [
    "この判断の根拠は何ですか？",
    "なぜこの結論に至ったのですか？",
    "この決定の背景にある考えは何ですか？",
  ],
  application: [
    "この知識をどのような場面で活用できますか？",
    "実際に適用する際の注意点は何ですか？",
    "具体的な使用例を挙げてください。",
  ],
  comparison: [
    "このノートで述べられている選択肢の違いは何ですか？",
    "メリットとデメリットを挙げてください。",
    "他のアプローチと比較した場合の特徴は何ですか？",
  ],
};

// ============================================================
// Content Analysis
// ============================================================

/**
 * コンテンツからトピックを抽出
 */
function extractTopic(content: string): string {
  // Markdown見出しを抽出
  const headingMatch = content.match(/^#+ (.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim().slice(0, 50);
  }

  // 最初の文を抽出
  const firstSentence = content
    .replace(/^#+ .+$/gm, "") // 見出しを除去
    .replace(/\n+/g, " ") // 改行をスペースに
    .trim()
    .split(/[。.!?]/)[0];

  return firstSentence.slice(0, 50);
}

/**
 * コンテンツからキーワードを抽出
 */
function extractKeywords(content: string): string[] {
  // Markdown記法を除去
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, "") // コードブロック除去
    .replace(/`[^`]+`/g, "") // インラインコード除去
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // リンクをテキストのみに
    .replace(/[#*_~>`]/g, "") // Markdown記号除去
    .replace(/\n+/g, " ");

  // 日本語の名詞っぽいものを抽出（簡易的な実装）
  // より高度な実装では形態素解析を使用
  const words = cleanContent
    .split(/[\s、。,.!?()（）「」『』【】\[\]]+/)
    .filter((w) => w.length >= 2 && w.length <= 20)
    .filter((w) => !isStopWord(w));

  // 頻度カウント
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // 頻度順にソートして上位10個を返す
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * ストップワード判定
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    "これ",
    "それ",
    "あれ",
    "この",
    "その",
    "あの",
    "ここ",
    "そこ",
    "あそこ",
    "こちら",
    "どこ",
    "だれ",
    "なに",
    "なん",
    "いつ",
    "どう",
    "から",
    "まで",
    "より",
    "ほど",
    "くらい",
    "など",
    "ため",
    "こと",
    "もの",
    "ところ",
    "よう",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "dare",
    "ought",
    "used",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "at",
    "by",
    "from",
    "as",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "again",
    "further",
    "then",
    "once",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "nor",
    "not",
    "only",
    "own",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "and",
    "but",
    "if",
    "or",
    "because",
    "until",
    "while",
    "although",
    "though",
    "after",
    "before",
    "since",
    "unless",
    "like",
  ]);

  return stopWords.has(word.toLowerCase());
}

/**
 * 決定パターンが含まれるかチェック
 */
function hasDecisionPattern(content: string): boolean {
  const patterns = [
    /した方が良/,
    /すべき/,
    /に決め/,
    /を選択/,
    /を採用/,
    /することにした/,
    /ようにする/,
    /方針として/,
  ];
  return patterns.some((p) => p.test(content));
}

/**
 * 比較パターンが含まれるかチェック
 */
function hasComparisonPattern(content: string): boolean {
  const patterns = [
    /vs\.?/i,
    /一方で/,
    /に対して/,
    /比較/,
    /違い/,
    /メリット/,
    /デメリット/,
    /長所/,
    /短所/,
    /利点/,
    /欠点/,
  ];
  return patterns.some((p) => p.test(content));
}

// ============================================================
// Question Generation
// ============================================================

/**
 * テンプレートベースで質問を生成
 */
export function generateTemplateQuestions(
  content: string,
  noteType: NoteType
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  const topic = extractTopic(content);
  const keywords = extractKeywords(content);

  // 1. 基本の想起質問（全ノートに追加）
  questions.push({
    type: "recall",
    question: TEMPLATES.recall[0],
    expectedKeywords: keywords,
    source: "template",
  });

  // 2. ノートタイプに応じた質問
  if (noteType === "decision") {
    // 決定ノート: 推論質問を追加
    questions.push({
      type: "reasoning",
      question: TEMPLATES.reasoning[0],
      expectedKeywords: keywords,
      source: "template",
    });

    // 比較パターンがあれば比較質問も追加
    if (hasComparisonPattern(content)) {
      questions.push({
        type: "comparison",
        question: TEMPLATES.comparison[0],
        expectedKeywords: keywords,
        source: "template",
      });
    }
  } else if (noteType === "learning") {
    // 学習ノート: 概念質問を追加
    if (topic) {
      questions.push({
        type: "concept",
        question: TEMPLATES.concept[0].replace("{topic}", topic),
        expectedKeywords: keywords,
        source: "template",
      });
    }

    // 応用質問を追加
    questions.push({
      type: "application",
      question: TEMPLATES.application[0],
      expectedKeywords: keywords,
      source: "template",
    });
  }

  return questions;
}

/**
 * 生成した質問を CreateQuestionInput 形式に変換
 */
export function toCreateQuestionInputs(
  questions: GeneratedQuestion[],
  contentHash: string
): CreateQuestionInput[] {
  return questions.map((q) => ({
    questionType: q.type,
    question: q.question,
    expectedKeywords: q.expectedKeywords,
    source: q.source,
    contentHash,
  }));
}

/**
 * コンテンツハッシュを生成（変更検出用）
 */
export function generateContentHash(content: string): string {
  // 空白・改行を正規化してからハッシュ化
  const normalized = content.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * 質問生成が必要かどうかを判定
 */
export function shouldGenerateQuestions(noteType: NoteType): boolean {
  // learning と decision タイプのみ質問を生成
  return noteType === "learning" || noteType === "decision";
}

/**
 * 質問タイプのラベルを取得
 */
export function getQuestionTypeLabel(type: RecallQuestionType): string {
  const labels: Record<RecallQuestionType, string> = {
    recall: "想起",
    concept: "概念理解",
    reasoning: "推論",
    application: "応用",
    comparison: "比較",
  };
  return labels[type];
}
