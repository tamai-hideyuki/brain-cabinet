/**
 * Isolation Repository
 *
 * 孤立ノート検出関連のDB操作
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// ============================================
// Connectivity Queries
// ============================================

/**
 * 入力エッジの集計
 */
export async function findInEdgeSummary(): Promise<Array<{
  target_note_id: string;
  in_degree: number;
  in_weight: number;
}>> {
  return db.all<{
    target_note_id: string;
    in_degree: number;
    in_weight: number;
  }>(sql`
    SELECT
      target_note_id,
      COUNT(*) as in_degree,
      SUM(weight) as in_weight
    FROM note_influence_edges
    GROUP BY target_note_id
  `);
}

/**
 * 出力エッジの集計
 */
export async function findOutEdgeSummary(): Promise<Array<{
  source_note_id: string;
  out_degree: number;
  out_weight: number;
}>> {
  return db.all<{
    source_note_id: string;
    out_degree: number;
    out_weight: number;
  }>(sql`
    SELECT
      source_note_id,
      COUNT(*) as out_degree,
      SUM(weight) as out_weight
    FROM note_influence_edges
    GROUP BY source_note_id
  `);
}

// ============================================
// Notes Queries
// ============================================

/**
 * 全ノートを取得
 */
export async function findAllNotes(): Promise<Array<{
  id: string;
  title: string;
  category: string | null;
  cluster_id: number | null;
  created_at: number;
  updated_at: number;
}>> {
  return db.all<{
    id: string;
    title: string;
    category: string | null;
    cluster_id: number | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT id, title, category, cluster_id, created_at, updated_at
    FROM notes
    ORDER BY updated_at DESC
  `);
}

/**
 * 特定のノートを取得
 */
export async function findNoteById(noteId: string): Promise<{
  id: string;
  title: string;
  category: string | null;
  cluster_id: number | null;
  created_at: number;
  updated_at: number;
} | null> {
  const rows = await db.all<{
    id: string;
    title: string;
    category: string | null;
    cluster_id: number | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT id, title, category, cluster_id, created_at, updated_at
    FROM notes
    WHERE id = ${noteId}
  `);
  return rows[0] ?? null;
}

/**
 * 全ノートのIDを取得
 */
export async function findAllNoteIds(): Promise<Array<{ id: string }>> {
  return db.all<{ id: string }>(sql`SELECT id FROM notes`);
}

/**
 * 指定IDのノート情報を取得
 */
export async function findNotesByIds(noteIds: string[]): Promise<Array<{
  id: string;
  title: string;
}>> {
  if (noteIds.length === 0) {
    return [];
  }
  return db.all<{
    id: string;
    title: string;
  }>(sql`
    SELECT id, title FROM notes WHERE id IN ${noteIds}
  `);
}
