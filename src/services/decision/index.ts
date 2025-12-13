/**
 * Decision Service
 *
 * 判断ファースト検索の中核
 * - decision.search: 判断ノートを優先した検索
 * - decision.context: 判断の詳細コンテキスト取得
 * - decision.promotionCandidates: 昇格候補の scratch 一覧
 * - decision.compare: 複数の判断を比較用に並べて取得
 */

import { db } from "../../db/client";
import { notes, noteInferences, DECAY_RATES } from "../../db/schema";
import type { Intent, NoteType, DecayProfile } from "../../db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { searchNotesHybrid } from "../searchService";
import {
  getLatestInference,
  classify,
  getSearchPriority,
} from "../inference";

// -------------------------------------
// 型定義
// -------------------------------------

export type DecisionSearchResult = {
  noteId: string;
  title: string;
  confidence: number;
  confidenceDetail?: {
    structural: number;
    experiential: number;
    temporal: number;
  };
  decayProfile: DecayProfile;
  effectiveScore: number;  // v4.2: 時間減衰適用後のスコア
  intent: Intent;
  reasoning: string;
  excerpt: string;
  score: number;
  createdAt: number;
};

export type DecisionContext = {
  decision: {
    noteId: string;
    title: string;
    content: string;
    confidence: number;
    confidenceDetail?: {
      structural: number;
      experiential: number;
      temporal: number;
    };
    decayProfile: DecayProfile;
    intent: Intent;
    reasoning: string;
  };
  relatedLearnings: Array<{
    noteId: string;
    title: string;
    excerpt: string;
  }>;
  contextualScratch: Array<{
    noteId: string;
    title: string;
    excerpt: string;
  }>;
};

export type PromotionCandidate = {
  noteId: string;
  title: string;
  currentType: NoteType;
  confidence: number;
  suggestedType: NoteType;
  reason: string;
};

// v4.3.1: 判断比較用の型
export type DecisionCompareItem = {
  noteId: string;
  title: string;
  excerpt: string;
  confidence: number;
  confidenceDetail?: {
    structural: number;
    experiential: number;
    temporal: number;
  };
  decayProfile: DecayProfile;
  effectiveScore: number;
  intent: Intent;
  reasoning: string;
  createdAt: number;
};

export type DecisionCompareResult = {
  query: string;
  decisions: DecisionCompareItem[];
  count: number;
};

// -------------------------------------
// ヘルパー
// -------------------------------------

const makeExcerpt = (content: string, maxLength = 100): string => {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
};

/**
 * v4.2 時間減衰を適用した effectiveScore を計算
 *
 * effectiveScore = similarity * confidence * timeDecayFactor
 * timeDecayFactor = e^(-λt) where t is days since creation
 *
 * stable な判断は最低 0.5 を保証（設計原則が完全に消えるのを防ぐ）
 */
function calculateEffectiveScore(
  similarity: number,
  confidence: number,
  createdAt: number,
  decayProfile: DecayProfile
): number {
  const now = Math.floor(Date.now() / 1000);
  const ageInDays = (now - createdAt) / (60 * 60 * 24);

  const decayRate = DECAY_RATES[decayProfile];
  let timeDecayFactor = Math.exp(-decayRate * ageInDays);

  // stable な判断は最低スコアを保証
  if (decayProfile === "stable") {
    timeDecayFactor = Math.max(timeDecayFactor, 0.5);
  }

  return Math.round(similarity * confidence * timeDecayFactor * 100) / 100;
}

// -------------------------------------
// decision.search
// -------------------------------------

export type DecisionSearchOptions = {
  intent?: Intent;
  minConfidence?: number;
  limit?: number;
};

export async function searchDecisions(
  query: string,
  options?: DecisionSearchOptions
): Promise<DecisionSearchResult[]> {
  const minConfidence = options?.minConfidence ?? 0.4;
  const limit = options?.limit ?? 10;

  // 1. ハイブリッド検索で候補を取得
  const hybridResults = await searchNotesHybrid(query, {
    keywordWeight: 0.5,
    semanticWeight: 0.5,
  });

  // 2. 各ノートの推論情報を取得し、decision をフィルタ
  const decisionResults: DecisionSearchResult[] = [];

  for (const result of hybridResults) {
    const noteData = result as unknown as {
      id: string;
      title: string;
      content: string;
      createdAt: number;
      hybridScore?: number;
    };
    const noteId = noteData.id;
    const inference = await getLatestInference(noteId);

    if (!inference) continue;
    if (inference.type !== "decision") continue;
    if (inference.confidence < minConfidence) continue;
    if (options?.intent && inference.intent !== options.intent) continue;

    const classification = classify(inference);
    const searchPriority = getSearchPriority(
      classification.primaryType,
      classification.reliability
    );

    // hybridScore と searchPriority を組み合わせた最終スコア
    const hybridScore = noteData.hybridScore ?? 0;
    const finalScore = hybridScore * 0.7 + searchPriority * 0.3;

    // v4.2: 時間減衰を適用した effectiveScore
    const effectiveScore = calculateEffectiveScore(
      hybridScore,
      inference.confidence,
      noteData.createdAt,
      inference.decayProfile
    );

    decisionResults.push({
      noteId,
      title: noteData.title,
      confidence: inference.confidence,
      confidenceDetail: inference.confidenceDetail,
      decayProfile: inference.decayProfile,
      effectiveScore,
      intent: inference.intent,
      reasoning: inference.reasoning,
      excerpt: makeExcerpt(noteData.content),
      score: Math.round(finalScore * 100) / 100,
      createdAt: noteData.createdAt,
    });
  }

  // 3. effectiveScore 順にソートして返す（時間減衰適用後）
  return decisionResults
    .sort((a, b) => b.effectiveScore - a.effectiveScore)
    .slice(0, limit);
}

// -------------------------------------
// decision.context
// -------------------------------------

export async function getDecisionContext(
  noteId: string
): Promise<DecisionContext | null> {
  // 1. 対象ノートを取得
  const noteRows = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  if (noteRows.length === 0) return null;
  const note = noteRows[0];

  // 2. 推論情報を取得
  const inference = await getLatestInference(noteId);
  if (!inference || inference.type !== "decision") {
    return null;
  }

  // 3. 関連する learning を検索（同じ intent）
  const learningRows = await db
    .select({
      noteId: noteInferences.noteId,
      type: noteInferences.type,
      intent: noteInferences.intent,
    })
    .from(noteInferences)
    .where(
      and(
        eq(noteInferences.type, "learning"),
        eq(noteInferences.intent, inference.intent)
      )
    )
    .orderBy(desc(noteInferences.createdAt))
    .limit(5);

  const relatedLearnings: DecisionContext["relatedLearnings"] = [];
  for (const row of learningRows) {
    const learningNote = await db
      .select()
      .from(notes)
      .where(eq(notes.id, row.noteId))
      .limit(1);
    if (learningNote.length > 0) {
      relatedLearnings.push({
        noteId: row.noteId,
        title: learningNote[0].title,
        excerpt: makeExcerpt(learningNote[0].content),
      });
    }
  }

  // 4. 関連する scratch を検索（同じ intent、直近のもの）
  const scratchRows = await db
    .select({
      noteId: noteInferences.noteId,
    })
    .from(noteInferences)
    .where(
      and(
        eq(noteInferences.type, "scratch"),
        eq(noteInferences.intent, inference.intent)
      )
    )
    .orderBy(desc(noteInferences.createdAt))
    .limit(3);

  const contextualScratch: DecisionContext["contextualScratch"] = [];
  for (const row of scratchRows) {
    const scratchNote = await db
      .select()
      .from(notes)
      .where(eq(notes.id, row.noteId))
      .limit(1);
    if (scratchNote.length > 0) {
      contextualScratch.push({
        noteId: row.noteId,
        title: scratchNote[0].title,
        excerpt: makeExcerpt(scratchNote[0].content),
      });
    }
  }

  return {
    decision: {
      noteId: note.id,
      title: note.title,
      content: note.content,
      confidence: inference.confidence,
      confidenceDetail: inference.confidenceDetail,
      decayProfile: inference.decayProfile,
      intent: inference.intent,
      reasoning: inference.reasoning,
    },
    relatedLearnings,
    contextualScratch,
  };
}

// -------------------------------------
// decision.promotionCandidates
// -------------------------------------

export async function getPromotionCandidates(
  limit = 10
): Promise<PromotionCandidate[]> {
  // scratch で confidence が 0.4-0.6 のものを取得
  // これらは昇格候補
  const rows = await db
    .select({
      noteId: noteInferences.noteId,
      type: noteInferences.type,
      intent: noteInferences.intent,
      confidence: noteInferences.confidence,
      reasoning: noteInferences.reasoning,
    })
    .from(noteInferences)
    .where(
      and(
        eq(noteInferences.type, "scratch"),
        gte(noteInferences.confidence, 0.35)
      )
    )
    .orderBy(desc(noteInferences.confidence))
    .limit(limit * 2); // 重複除去用に多めに取得

  // 各ノートの最新推論のみを使う
  const latestByNote = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    if (!latestByNote.has(row.noteId)) {
      latestByNote.set(row.noteId, row);
    }
  }

  const candidates: PromotionCandidate[] = [];

  for (const [noteId, row] of latestByNote) {
    const noteRows = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (noteRows.length === 0) continue;
    const note = noteRows[0];

    // 推奨タイプを判定（reasoning から推測）
    let suggestedType: NoteType = "learning";
    let reason = "内容を整理すれば学習メモに昇格可能";

    if (
      row.reasoning?.includes("判断") ||
      row.reasoning?.includes("decision")
    ) {
      suggestedType = "decision";
      reason = "判断要素が含まれており、決定メモに昇格可能";
    }

    candidates.push({
      noteId: note.id,
      title: note.title,
      currentType: row.type as NoteType,
      confidence: row.confidence,
      suggestedType,
      reason,
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

// -------------------------------------
// decision.compare
// -------------------------------------

export type DecisionCompareOptions = {
  intent?: Intent;
  minConfidence?: number;
  limit?: number;
};

/**
 * v4.3.1: 複数の判断を比較用に並べて取得
 *
 * 同じトピックについて過去に下した判断を時系列で並べ、
 * 思考の変遷を振り返るための機能。
 *
 * P1 実装: searchDecisions を流用し、createdAt 順にソート
 */
export async function compareDecisions(
  query: string,
  options?: DecisionCompareOptions
): Promise<DecisionCompareResult> {
  const minConfidence = options?.minConfidence ?? 0.3; // 比較用は低めの閾値
  const limit = options?.limit ?? 5;

  // searchDecisions を流用して判断を取得
  const searchResults = await searchDecisions(query, {
    intent: options?.intent,
    minConfidence,
    limit: limit * 2, // 時系列ソート後に絞り込むため多めに取得
  });

  // 時系列順（古い順）にソートして比較しやすくする
  const sortedByTime = searchResults
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, limit);

  // DecisionCompareItem に変換
  const decisions: DecisionCompareItem[] = sortedByTime.map((result) => ({
    noteId: result.noteId,
    title: result.title,
    excerpt: result.excerpt,
    confidence: result.confidence,
    confidenceDetail: result.confidenceDetail,
    decayProfile: result.decayProfile,
    effectiveScore: result.effectiveScore,
    intent: result.intent,
    reasoning: result.reasoning,
    createdAt: result.createdAt,
  }));

  return {
    query,
    decisions,
    count: decisions.length,
  };
}
