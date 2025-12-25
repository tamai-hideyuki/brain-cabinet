/**
 * セマンティック変化分類サービス (v5.6)
 *
 * ノート編集時の意味的変化を分類し、変化タイプを判定する。
 *
 * 変化タイプ:
 * - expansion: 拡張（情報追加、範囲拡大）
 * - contraction: 縮小（絞り込み、要約）
 * - pivot: 転換（主題変更、方向転換）
 * - deepening: 深化（詳細化、具体化）
 * - refinement: 洗練（推敲、誤字修正）
 */

import type { SemanticChangeType, SemanticChangeDetail } from "../../db/schema";
import { cosineSimilarity } from "../embeddingService";

// 分類閾値
const REFINEMENT_THRESHOLD = 0.05;    // semantic_diff < 0.05 → refinement
const PIVOT_THRESHOLD = 0.4;          // topic_shift > 0.4 → pivot
const DEEPENING_VOCAB_THRESHOLD = 0.7; // vocabulary_overlap > 0.7 → deepening候補

/**
 * テキストからトークンを抽出（日本語 + 英語対応）
 */
export const tokenize = (text: string): string[] => {
  // 日本語: ひらがな/カタカナ/漢字の連続
  // 英語: 2文字以上の英単語
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g;
  const englishPattern = /[a-zA-Z]{2,}/g;

  const japanese = text.match(japanesePattern) || [];
  const english = text.match(englishPattern) || [];

  return [...japanese, ...english.map((w) => w.toLowerCase())];
};

/**
 * 見出し構造を抽出
 */
export const extractHeadings = (text: string): string[] => {
  const headingPattern = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
};

/**
 * 段落数を計算
 */
export const countParagraphs = (text: string): number => {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
};

/**
 * 語彙重複率を計算 (Jaccard係数)
 */
export const calculateVocabularyOverlap = (
  oldTokens: string[],
  newTokens: string[]
): number => {
  const oldSet = new Set(oldTokens);
  const newSet = new Set(newTokens);

  const intersection = new Set([...oldSet].filter((x) => newSet.has(x)));
  const union = new Set([...oldSet, ...newSet]);

  if (union.size === 0) return 1.0;
  return intersection.size / union.size;
};

/**
 * 構造類似度を計算
 * 見出し構造と段落数を比較
 */
export const calculateStructuralSimilarity = (
  oldText: string,
  newText: string
): number => {
  const oldHeadings = extractHeadings(oldText);
  const newHeadings = extractHeadings(newText);
  const oldParagraphs = countParagraphs(oldText);
  const newParagraphs = countParagraphs(newText);

  // 見出し類似度 (Jaccard)
  const headingOverlap = calculateVocabularyOverlap(oldHeadings, newHeadings);

  // 段落数類似度 (比率ベース)
  const maxParagraphs = Math.max(oldParagraphs, newParagraphs, 1);
  const minParagraphs = Math.min(oldParagraphs, newParagraphs);
  const paragraphSimilarity = minParagraphs / maxParagraphs;

  // 加重平均: 見出し 60%, 段落 40%
  return headingOverlap * 0.6 + paragraphSimilarity * 0.4;
};

/**
 * 変化方向ベクトルを計算（正規化済み）
 */
export const calculateDirectionVector = (
  oldEmbedding: number[],
  newEmbedding: number[]
): number[] => {
  if (oldEmbedding.length !== newEmbedding.length) {
    throw new Error("Embedding dimensions must match");
  }

  // 差分ベクトル: new - old
  const diff = newEmbedding.map((v, i) => v - oldEmbedding[i]);

  // L2ノルムを計算
  const norm = Math.sqrt(diff.reduce((sum, v) => sum + v * v, 0));

  // ゼロベクトルの場合はそのまま返す
  if (norm === 0) {
    return diff;
  }

  // 正規化
  return diff.map((v) => v / norm);
};

/**
 * トピック移動度を計算
 *
 * embedding空間での移動距離を正規化した値。
 * cosine距離ベースだが、語彙変化も加味する。
 */
export const calculateTopicShift = (
  oldEmbedding: number[],
  newEmbedding: number[],
  vocabularyOverlap: number
): number => {
  const cosineDist = 1 - cosineSimilarity(oldEmbedding, newEmbedding);

  // 語彙重複が低い場合はトピック移動を強調
  const vocabFactor = 1 - vocabularyOverlap;

  // 加重: cosine距離 70%, 語彙変化 30%
  return Math.min(1.0, cosineDist * 0.7 + vocabFactor * 0.3);
};

/**
 * 変化タイプを分類
 */
export const classifyChangeType = (
  semanticDiff: number,
  contentLengthRatio: number,
  topicShift: number,
  vocabularyOverlap: number,
  structuralSimilarity: number
): { type: SemanticChangeType; confidence: number } => {
  // 1. Refinement: 変化がほぼない場合
  if (semanticDiff < REFINEMENT_THRESHOLD) {
    return { type: "refinement", confidence: 0.95 };
  }

  // 2. Pivot: トピックが大きく移動した場合
  if (topicShift > PIVOT_THRESHOLD) {
    const confidence = Math.min(0.95, 0.5 + topicShift * 0.5);
    return { type: "pivot", confidence };
  }

  // 3. Expansion vs Contraction vs Deepening
  // 長さ比率と語彙変化から判定

  // 大幅に長くなった場合: expansion
  if (contentLengthRatio > 1.3) {
    // 語彙も増えているか確認
    const confidence = Math.min(0.9, 0.5 + (contentLengthRatio - 1) * 0.4);
    return { type: "expansion", confidence };
  }

  // 大幅に短くなった場合: contraction
  if (contentLengthRatio < 0.7) {
    const confidence = Math.min(0.9, 0.5 + (1 - contentLengthRatio) * 0.4);
    return { type: "contraction", confidence };
  }

  // 長さは同程度だが内容が変わっている場合
  // 語彙重複が高い → deepening（同じトピックで深掘り）
  if (vocabularyOverlap > DEEPENING_VOCAB_THRESHOLD) {
    // 構造も維持されている場合は確信度UP
    const structureBonus = structuralSimilarity > 0.6 ? 0.1 : 0;
    const confidence = Math.min(0.9, 0.6 + structureBonus);
    return { type: "deepening", confidence };
  }

  // それ以外: 中程度のピボット or 拡張・縮小の混合
  // デフォルトは expansion（情報が変わっている）
  if (contentLengthRatio >= 1.0) {
    return { type: "expansion", confidence: 0.5 };
  } else {
    return { type: "contraction", confidence: 0.5 };
  }
};

/**
 * セマンティック変化を分析
 *
 * @param oldText 変更前のテキスト
 * @param newText 変更後のテキスト
 * @param oldEmbedding 変更前のembedding
 * @param newEmbedding 変更後のembedding
 * @param semanticDiff 既に計算済みのsemantic_diff（オプション）
 */
export const analyzeSemanticChange = (
  oldText: string,
  newText: string,
  oldEmbedding: number[],
  newEmbedding: number[],
  semanticDiff?: number
): SemanticChangeDetail => {
  // 1. 基本メトリクスを計算
  const oldLength = oldText.length;
  const newLength = newText.length;
  const contentLengthRatio = oldLength > 0 ? newLength / oldLength : 1.0;

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const vocabularyOverlap = calculateVocabularyOverlap(oldTokens, newTokens);

  const structuralSimilarity = calculateStructuralSimilarity(oldText, newText);

  // 2. semantic_diff を計算（渡されていない場合）
  const magnitude =
    semanticDiff ?? 1 - cosineSimilarity(oldEmbedding, newEmbedding);

  // 3. トピック移動度を計算
  const topicShift = calculateTopicShift(
    oldEmbedding,
    newEmbedding,
    vocabularyOverlap
  );

  // 4. 変化方向ベクトルを計算
  const direction = calculateDirectionVector(oldEmbedding, newEmbedding);

  // 5. 変化タイプを分類
  const { type, confidence } = classifyChangeType(
    magnitude,
    contentLengthRatio,
    topicShift,
    vocabularyOverlap,
    structuralSimilarity
  );

  return {
    type,
    confidence,
    magnitude,
    direction,
    metrics: {
      contentLengthRatio: Math.round(contentLengthRatio * 1000) / 1000,
      topicShift: Math.round(topicShift * 1000) / 1000,
      vocabularyOverlap: Math.round(vocabularyOverlap * 1000) / 1000,
      structuralSimilarity: Math.round(structuralSimilarity * 1000) / 1000,
    },
  };
};

/**
 * SemanticChangeDetail を JSON 文字列に変換（DB保存用）
 * 方向ベクトルは省略してサイズを削減
 */
export const serializeChangeDetail = (
  detail: SemanticChangeDetail,
  includeDirection = false
): string => {
  const { direction, ...rest } = detail;
  if (includeDirection) {
    return JSON.stringify(detail);
  }
  return JSON.stringify(rest);
};

/**
 * JSON 文字列から SemanticChangeDetail を復元
 */
export const deserializeChangeDetail = (
  json: string
): Omit<SemanticChangeDetail, "direction"> & { direction?: number[] } => {
  return JSON.parse(json);
};
