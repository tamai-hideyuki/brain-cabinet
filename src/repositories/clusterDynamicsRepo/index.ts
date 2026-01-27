import { db } from "../../db/client";
import { sql } from "drizzle-orm";

/**
 * クラスタの最新centroidを取得
 */
export const findLatestCentroid = async (
  clusterId: number
): Promise<{ centroid: Buffer; date: string } | null> => {
  const rows = await db.all<{
    centroid: Buffer;
    date: string;
  }>(sql`
    SELECT centroid, date FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
    ORDER BY date DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
};

/**
 * クラスタ所属ノートのembeddingを取得
 */
export const findNoteEmbeddingsByClusterId = async (
  clusterId: number
): Promise<Array<{
  note_id: string;
  title: string;
  embedding: Buffer;
  updated_at: number;
  category: string | null;
}>> => {
  return await db.all<{
    note_id: string;
    title: string;
    embedding: Buffer;
    updated_at: number;
    category: string | null;
  }>(sql`
    SELECT n.id as note_id, n.title, n.category, n.updated_at, ne.embedding
    FROM notes n
    JOIN note_embeddings ne ON n.id = ne.note_id
    WHERE n.cluster_id = ${clusterId}
  `);
};
