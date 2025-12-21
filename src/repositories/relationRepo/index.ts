import { db } from "../../db/client";
import { noteRelations, type RelationType } from "../../db/schema";
import { eq, or, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreateRelationInput = {
  sourceNoteId: string;
  targetNoteId: string;
  relationType: RelationType;
  score: number;
};

/**
 * Relationを作成
 */
export const createRelation = async (data: CreateRelationInput) => {
  const now = Math.floor(Date.now() / 1000);
  return await db.insert(noteRelations).values({
    id: randomUUID(),
    sourceNoteId: data.sourceNoteId,
    targetNoteId: data.targetNoteId,
    relationType: data.relationType,
    score: String(data.score),
    createdAt: now,
  });
};

/**
 * 複数のRelationを一括作成
 */
export const createRelations = async (relations: CreateRelationInput[]) => {
  if (relations.length === 0) return;

  const now = Math.floor(Date.now() / 1000);
  const values = relations.map((r) => ({
    id: randomUUID(),
    sourceNoteId: r.sourceNoteId,
    targetNoteId: r.targetNoteId,
    relationType: r.relationType,
    score: String(r.score),
    createdAt: now,
  }));

  return await db.insert(noteRelations).values(values);
};

/**
 * ノートからのRelation（sourceとして）を全削除
 */
export const deleteRelationsBySourceNote = async (noteId: string) => {
  return await db
    .delete(noteRelations)
    .where(eq(noteRelations.sourceNoteId, noteId));
};

/**
 * ノートに関連する全Relation（source/target両方）を削除
 */
export const deleteAllRelationsForNote = async (noteId: string) => {
  return await db
    .delete(noteRelations)
    .where(
      or(
        eq(noteRelations.sourceNoteId, noteId),
        eq(noteRelations.targetNoteId, noteId)
      )
    );
};

/**
 * ノートの関連ノートを取得（自分がsource）
 */
export const findRelationsBySourceNote = async (noteId: string) => {
  return await db
    .select()
    .from(noteRelations)
    .where(eq(noteRelations.sourceNoteId, noteId))
    .orderBy(desc(noteRelations.createdAt));
};

/**
 * ノートの関連ノートを取得（自分がtarget）
 */
export const findRelationsByTargetNote = async (noteId: string) => {
  return await db
    .select()
    .from(noteRelations)
    .where(eq(noteRelations.targetNoteId, noteId))
    .orderBy(desc(noteRelations.createdAt));
};

/**
 * ノートの全関連ノートを取得（source/target両方）
 */
export const findAllRelationsForNote = async (noteId: string) => {
  return await db
    .select()
    .from(noteRelations)
    .where(
      or(
        eq(noteRelations.sourceNoteId, noteId),
        eq(noteRelations.targetNoteId, noteId)
      )
    )
    .orderBy(desc(noteRelations.createdAt));
};

/**
 * ノートに関連する全Relationを削除（トランザクション対応）
 */
export const deleteAllRelationsForNoteRaw = async (
  tx: Transaction,
  noteId: string
) => {
  await tx.delete(noteRelations).where(
    or(
      eq(noteRelations.sourceNoteId, noteId),
      eq(noteRelations.targetNoteId, noteId)
    )
  );
};
