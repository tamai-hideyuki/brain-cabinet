/**
 * Decision Service
 *
 * 判断ファースト検索の中核
 * - decision.search: 判断ノートを優先した検索
 * - decision.context: 判断の詳細コンテキスト取得
 * - decision.promotionCandidates: 昇格候補の scratch 一覧
 */

import { db } from "../../db/client";
import { notes, noteInferences } from "../../db/schema";
import type { Intent, NoteType } from "../../db/schema";
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
  intent: Intent;
  reasoning: string;
  excerpt: string;
  score: number;
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

// -------------------------------------
// ヘルパー
// -------------------------------------

const makeExcerpt = (content: string, maxLength = 100): string => {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
};

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

    decisionResults.push({
      noteId,
      title: noteData.title,
      confidence: inference.confidence,
      confidenceDetail: inference.confidenceDetail,
      intent: inference.intent,
      reasoning: inference.reasoning,
      excerpt: makeExcerpt(noteData.content),
      score: Math.round(finalScore * 100) / 100,
    });
  }

  // 3. スコア順にソートして返す
  return decisionResults
    .sort((a, b) => b.score - a.score)
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
