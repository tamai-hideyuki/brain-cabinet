import { db } from "../db/client";
import { clusters, notes, clusterHistory } from "../db/schema";
import { eq, sql } from "drizzle-orm";

// トランザクション用の型定義
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ClusterInput = {
  id: number;
  centroid: number[];
  size: number;
  sampleNoteId: string | null;
};

/**
 * クラスタを保存（UPSERT）
 */
export const saveCluster = async (data: ClusterInput) => {
  const now = Math.floor(Date.now() / 1000);
  const centroidBase64 = arrayToBase64(data.centroid);

  await db.run(sql`
    INSERT INTO clusters (id, centroid, size, sample_note_id, created_at, updated_at)
    VALUES (${data.id}, ${centroidBase64}, ${data.size}, ${data.sampleNoteId}, ${now}, ${now})
    ON CONFLICT(id) DO UPDATE SET
      centroid = ${centroidBase64},
      size = ${data.size},
      sample_note_id = ${data.sampleNoteId},
      updated_at = ${now}
  `);
};

/**
 * 複数クラスタを一括保存
 */
export const saveClusters = async (clusterList: ClusterInput[]) => {
  for (const cluster of clusterList) {
    await saveCluster(cluster);
  }
};

/**
 * 全クラスタを削除
 */
export const deleteAllClusters = async () => {
  await db.delete(clusters);
};

/**
 * 全クラスタを取得
 */
export const findAllClusters = async () => {
  const result = await db.select().from(clusters);
  return result.map((c) => ({
    ...c,
    centroid: c.centroid ? base64ToArray(c.centroid) : null,
  }));
};

/**
 * 特定クラスタを取得
 */
export const findClusterById = async (id: number) => {
  const result = await db
    .select()
    .from(clusters)
    .where(eq(clusters.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const c = result[0];
  return {
    ...c,
    centroid: c.centroid ? base64ToArray(c.centroid) : null,
  };
};

/**
 * クラスタに属するノートを取得
 */
export const findNotesByClusterId = async (clusterId: number) => {
  return await db
    .select()
    .from(notes)
    .where(eq(notes.clusterId, clusterId));
};

/**
 * ノートのcluster_idを更新
 */
export const updateNoteClusterId = async (noteId: string, clusterId: number) => {
  await db
    .update(notes)
    .set({ clusterId })
    .where(eq(notes.id, noteId));
};

/**
 * 全ノートのcluster_idを一括更新（バッチ処理）
 */
export const updateAllNoteClusterIds = async (
  assignments: Array<{ noteId: string; clusterId: number }>
) => {
  for (const { noteId, clusterId } of assignments) {
    await updateNoteClusterId(noteId, clusterId);
  }
};

/**
 * 全ノートのcluster_idをリセット
 */
export const resetAllNoteClusterIds = async () => {
  await db.run(sql`UPDATE notes SET cluster_id = NULL`);
};

// ヘルパー関数

/**
 * number[] を Base64 文字列に変換
 */
const arrayToBase64 = (arr: number[]): string => {
  const float32 = new Float32Array(arr);
  const buffer = Buffer.from(float32.buffer);
  return buffer.toString("base64");
};

/**
 * Base64 文字列を number[] に変換
 */
const base64ToArray = (base64: string): number[] => {
  const buffer = Buffer.from(base64, "base64");
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 4
  );
  return Array.from(float32);
};

/**
 * 特定ノートのクラスタ履歴を削除（トランザクション対応）
 */
export const deleteClusterHistoryByNoteIdRaw = async (
  tx: Transaction,
  noteId: string
) => {
  await tx.delete(clusterHistory).where(eq(clusterHistory.noteId, noteId));
};
