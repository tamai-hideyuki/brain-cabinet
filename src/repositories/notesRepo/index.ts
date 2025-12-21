import { db } from "../../db/client";
import { notes, noteInfluenceEdges, type Category } from "../../db/schema";
import { eq, or, sql, inArray, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { extractMetadata } from "../../utils/metadata";
import { insertFTSRaw, updateFTSRaw, deleteFTSRaw } from "../ftsRepo";
import { deleteHistoryByNoteIdRaw } from "../historyRepo";
import { deleteAllRelationsForNoteRaw } from "../relationRepo";
import { deleteClusterHistoryByNoteIdRaw } from "../clusterRepo";
import { deleteEmbeddingRaw } from "../embeddingRepo";

export const findAllNotes = async () => {
  return await db
    .select()
    .from(notes)
    .orderBy(desc(notes.updatedAt), desc(notes.createdAt));
};

export const findNoteById = async (id: string) => {
  const result = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  return result[0] ?? null;
};

/**
 * ノートを作成（トランザクション内でnotes + FTS5を同期）
 */
export const createNoteInDB = async (title: string, content: string) => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const metadata = extractMetadata(content, title);

  const tagsJson = JSON.stringify(metadata.tags);
  const headingsJson = JSON.stringify(metadata.headings);

  // トランザクションでnotes挿入とFTS5挿入を原子的に実行
  await db.transaction(async (tx) => {
    await tx.insert(notes).values({
      id,
      title,
      path: `api-created/${title}.md`,
      content,
      tags: tagsJson,
      category: metadata.category,
      headings: headingsJson,
      createdAt: now,
      updatedAt: now,
    });

    // FTS5に同期（トランザクション内）
    await insertFTSRaw(tx, id, title, content, tagsJson, headingsJson);
  });

  return await findNoteById(id);
};

/**
 * ノートを更新（トランザクション内でnotes + FTS5を同期）
 */
export const updateNoteInDB = async (id: string, newContent: string, newTitle?: string) => {
  const now = Math.floor(Date.now() / 1000);
  const note = await findNoteById(id);
  if (!note) return null;

  const title = newTitle ?? note.title;
  const metadata = extractMetadata(newContent, title);
  const tagsJson = JSON.stringify(metadata.tags);
  const headingsJson = JSON.stringify(metadata.headings);

  // トランザクションでnotes更新とFTS5更新を原子的に実行
  await db.transaction(async (tx) => {
    await tx
      .update(notes)
      .set({
        title,
        content: newContent,
        tags: tagsJson,
        category: metadata.category,
        headings: headingsJson,
        updatedAt: now,
      })
      .where(eq(notes.id, id));

    // FTS5に同期（トランザクション内）
    await updateFTSRaw(tx, id, title, newContent, tagsJson, headingsJson);
  });

  return await findNoteById(id);
};

/**
 * ノートを削除（トランザクション内で全関連データを一括削除）
 *
 * 削除対象:
 * - notes (本体)
 * - notes_fts (全文検索インデックス)
 * - note_history (変更履歴)
 * - note_relations (類似・派生関係)
 * - note_embeddings (ベクトル埋め込み)
 * - cluster_history (クラスタ遷移履歴)
 * - note_influence_edges (影響グラフ)
 */
export const deleteNoteInDB = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) return null;

  // トランザクションで全関連データを原子的に削除
  await db.transaction(async (tx) => {
    // 1. 影響グラフのエッジを削除（source/target両方）
    await tx.delete(noteInfluenceEdges).where(
      or(
        eq(noteInfluenceEdges.sourceNoteId, id),
        eq(noteInfluenceEdges.targetNoteId, id)
      )
    );

    // 2. クラスタ履歴を削除
    await deleteClusterHistoryByNoteIdRaw(tx, id);

    // 3. ノート関連を削除（類似・派生関係）
    await deleteAllRelationsForNoteRaw(tx, id);

    // 4. 変更履歴を削除
    await deleteHistoryByNoteIdRaw(tx, id);

    // 5. Embeddingを削除
    await deleteEmbeddingRaw(tx, id);

    // 6. FTS5インデックスを削除
    await deleteFTSRaw(tx, id);

    // 7. 本体を削除（最後に実行）
    await tx.delete(notes).where(eq(notes.id, id));
  });

  return note;
};

/**
 * 複数ノートのカテゴリを一括更新
 */
export const updateNotesCategoryInDB = async (ids: string[], category: Category) => {
  if (ids.length === 0) return { updated: 0 };

  const now = Math.floor(Date.now() / 1000);

  await db
    .update(notes)
    .set({ category, updatedAt: now })
    .where(inArray(notes.id, ids));

  return { updated: ids.length };
};

/**
 * 複数ノートのIDを検証（存在するIDのみ返す）
 */
export const findNotesByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  return await db.select().from(notes).where(inArray(notes.id, ids));
};
