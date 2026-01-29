import { db } from "../../db/client";
import { notes, noteInfluenceEdges, type Category } from "../../db/schema";
import { eq, or, sql, inArray, desc, isNull, isNotNull, and, lt } from "drizzle-orm";
import { randomUUID } from "crypto";
import { extractMetadata } from "../../utils/metadata";
import { insertFTSRaw, updateFTSRaw, deleteFTSRaw } from "../ftsRepo";
import { deleteHistoryByNoteIdRaw } from "../historyRepo";
import { deleteAllRelationsForNoteRaw } from "../relationRepo";
import { deleteClusterHistoryByNoteIdRaw } from "../clusterRepo";
import { deleteEmbeddingRaw } from "../embeddingRepo";
import { deleteImagesByNoteIdRaw } from "../noteImagesRepo";

/**
 * タイトルからパス生成時に危険な文字をスペースに置換
 */
const sanitizePath = (title: string): string =>
  title.replace(/[\/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();

export const findAllNotes = async () => {
  return await db
    .select()
    .from(notes)
    .where(isNull(notes.deletedAt))
    .orderBy(desc(notes.updatedAt), desc(notes.createdAt));
};

export const findNoteById = async (id: string, includeDeleted = false) => {
  const conditions = includeDeleted
    ? eq(notes.id, id)
    : and(eq(notes.id, id), isNull(notes.deletedAt));
  const result = await db.select().from(notes).where(conditions).limit(1);
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
      path: `api-created/${sanitizePath(title)}.md`,
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
 * ノートをソフトデリート（deletedAt を設定するだけ）
 * 1時間以内なら復元可能
 */
export const softDeleteNoteInDB = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) return null;

  const now = Math.floor(Date.now() / 1000);

  await db.transaction(async (tx) => {
    // deletedAt を設定
    await tx
      .update(notes)
      .set({ deletedAt: now })
      .where(eq(notes.id, id));

    // FTS5インデックスからは削除（検索に出てこないように）
    await deleteFTSRaw(tx, id);
  });

  return note;
};

/**
 * ノートを復元（deletedAt を NULL に戻す）
 */
export const restoreNoteInDB = async (id: string) => {
  const note = await findNoteById(id, true); // 削除済みも含めて検索
  if (!note || !note.deletedAt) return null; // 削除されていないノートは復元不可

  await db.transaction(async (tx) => {
    // deletedAt を NULL に
    await tx
      .update(notes)
      .set({ deletedAt: null })
      .where(eq(notes.id, id));

    // FTS5インデックスを復元
    const tagsJson = note.tags ?? "[]";
    const headingsJson = note.headings ?? "[]";
    await insertFTSRaw(tx, id, note.title, note.content, tagsJson, headingsJson);
  });

  return await findNoteById(id);
};

/**
 * 削除済みノート一覧を取得
 */
export const findDeletedNotes = async () => {
  return await db
    .select()
    .from(notes)
    .where(isNotNull(notes.deletedAt))
    .orderBy(desc(notes.deletedAt));
};

/**
 * ノートを完全削除（トランザクション内で全関連データを一括削除）
 *
 * 削除対象:
 * - notes (本体)
 * - notes_fts (全文検索インデックス) ※ソフトデリート時に既に削除済み
 * - note_history (変更履歴)
 * - note_relations (類似・派生関係)
 * - note_embeddings (ベクトル埋め込み)
 * - cluster_history (クラスタ遷移履歴)
 * - note_influence_edges (影響グラフ)
 * - note_images (画像)
 */
export const hardDeleteNoteInDB = async (id: string) => {
  const note = await findNoteById(id, true); // 削除済みも含めて検索
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

    // 6. FTS5インデックスを削除（念のため）
    await deleteFTSRaw(tx, id);

    // 7. 画像を削除
    await deleteImagesByNoteIdRaw(tx, id);

    // 8. 本体を削除（最後に実行）
    await tx.delete(notes).where(eq(notes.id, id));
  });

  return note;
};

/**
 * 期限切れの削除済みノートを完全削除
 * @param thresholdSeconds 削除からの経過秒数（デフォルト: 3600秒 = 1時間）
 * @returns 削除されたノート数
 */
export const purgeExpiredDeletedNotes = async (thresholdSeconds = 3600): Promise<number> => {
  const cutoffTime = Math.floor(Date.now() / 1000) - thresholdSeconds;

  // 期限切れの削除済みノートを取得
  const expiredNotes = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoffTime)));

  // 各ノートを完全削除
  let deletedCount = 0;
  for (const { id } of expiredNotes) {
    await hardDeleteNoteInDB(id);
    deletedCount++;
  }

  return deletedCount;
};

/**
 * @deprecated Use softDeleteNoteInDB instead
 */
export const deleteNoteInDB = softDeleteNoteInDB;

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
