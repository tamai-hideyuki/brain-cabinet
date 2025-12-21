/**
 * Review Repository - 質問操作
 */

import { db } from "../../db/client";
import {
  recallQuestions,
  type RecallQuestionType,
  type QuestionSource,
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { RecallQuestion, CreateQuestionInput } from "./types";

// ============================================================
// Helper Functions
// ============================================================

const parseQuestionRow = (
  row: typeof recallQuestions.$inferSelect
): RecallQuestion => ({
  id: row.id,
  noteId: row.noteId,
  questionType: row.questionType as RecallQuestionType,
  question: row.question,
  expectedKeywords: row.expectedKeywords
    ? JSON.parse(row.expectedKeywords)
    : [],
  source: row.source as QuestionSource,
  isActive: row.isActive === 1,
  contentHash: row.contentHash,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// ============================================================
// Question Operations
// ============================================================

/**
 * 質問を作成
 */
export const createQuestion = async (
  noteId: string,
  input: CreateQuestionInput
): Promise<number> => {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .insert(recallQuestions)
    .values({
      noteId,
      questionType: input.questionType,
      question: input.question,
      expectedKeywords: input.expectedKeywords
        ? JSON.stringify(input.expectedKeywords)
        : null,
      source: input.source ?? "template",
      isActive: 1,
      contentHash: input.contentHash ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: recallQuestions.id });

  return result[0].id;
};

/**
 * 複数の質問を一括作成
 */
export const createQuestions = async (
  noteId: string,
  inputs: CreateQuestionInput[]
): Promise<number[]> => {
  const now = Math.floor(Date.now() / 1000);

  const values = inputs.map((input) => ({
    noteId,
    questionType: input.questionType,
    question: input.question,
    expectedKeywords: input.expectedKeywords
      ? JSON.stringify(input.expectedKeywords)
      : null,
    source: input.source ?? "template",
    isActive: 1,
    contentHash: input.contentHash ?? null,
    createdAt: now,
    updatedAt: now,
  }));

  const result = await db
    .insert(recallQuestions)
    .values(values)
    .returning({ id: recallQuestions.id });

  return result.map((r) => r.id);
};

/**
 * ノートIDで質問を取得
 */
export const getQuestionsByNoteId = async (
  noteId: string,
  activeOnly = true
): Promise<RecallQuestion[]> => {
  let query = db
    .select()
    .from(recallQuestions)
    .where(eq(recallQuestions.noteId, noteId));

  if (activeOnly) {
    query = db
      .select()
      .from(recallQuestions)
      .where(
        and(
          eq(recallQuestions.noteId, noteId),
          eq(recallQuestions.isActive, 1)
        )
      );
  }

  const result = await query.orderBy(recallQuestions.createdAt);
  return result.map(parseQuestionRow);
};

/**
 * 質問を非アクティブ化（ノートID指定）
 */
export const deactivateQuestionsByNoteId = async (
  noteId: string
): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(recallQuestions)
    .set({
      isActive: 0,
      updatedAt: now,
    })
    .where(eq(recallQuestions.noteId, noteId));
};

/**
 * 質問を削除（ノートID指定）
 */
export const deleteQuestionsByNoteId = async (
  noteId: string
): Promise<void> => {
  await db.delete(recallQuestions).where(eq(recallQuestions.noteId, noteId));
};

/**
 * コンテンツハッシュで質問の存在を確認
 */
export const hasQuestionsWithHash = async (
  noteId: string,
  contentHash: string
): Promise<boolean> => {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(recallQuestions)
    .where(
      and(
        eq(recallQuestions.noteId, noteId),
        eq(recallQuestions.contentHash, contentHash),
        eq(recallQuestions.isActive, 1)
      )
    );

  return (result[0]?.count ?? 0) > 0;
};
