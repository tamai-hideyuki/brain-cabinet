import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { logger } from "../../utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const systemRoute = new Hono();

type TableInfo = {
  name: string;
  label: string;
  rowCount: number;
  size: number;
};

type StorageResponse = {
  totalSize: number;
  tables: TableInfo[];
};

// テーブル定義（BLOBカラムを持つテーブルは特別扱い）
const TABLE_DEFINITIONS: Array<{
  name: string;
  label: string;
  blobColumns?: string[];
}> = [
  // コアテーブル
  { name: "notes", label: "ノート" },
  { name: "note_history", label: "ノート履歴" },
  { name: "note_relations", label: "ノート関連" },
  { name: "note_embeddings", label: "埋め込みベクトル", blobColumns: ["embedding"] },
  { name: "note_images", label: "ノート画像", blobColumns: ["data"] },  // v5.4
  // クラスタ関連
  { name: "clusters", label: "クラスタ" },
  { name: "cluster_history", label: "クラスタ履歴" },
  { name: "cluster_dynamics", label: "クラスタ動態", blobColumns: ["centroid"] },
  // グラフ・影響関連
  { name: "concept_graph_edges", label: "概念グラフ" },
  { name: "note_influence_edges", label: "ノート影響" },
  // メトリクス・ドリフト
  { name: "metrics_time_series", label: "メトリクス時系列", blobColumns: ["growth_vector"] },
  { name: "drift_events", label: "ドリフトイベント" },
  // PTM
  { name: "ptm_snapshots", label: "PTMスナップショット", blobColumns: ["center_of_gravity", "cluster_strengths", "influence_map", "growth_direction"] },
  // 推論関連（v4〜v6）
  { name: "note_inferences", label: "ノート推論" },
  { name: "llm_inference_results", label: "LLM推論結果" },  // v6
  { name: "promotion_notifications", label: "昇格通知" },
  { name: "decision_counterevidences", label: "反証ログ" },
  // レビュー機能
  { name: "review_schedules", label: "レビュースケジュール" },
  { name: "recall_questions", label: "想起質問" },
  { name: "review_sessions", label: "レビューセッション" },
  // ブックマーク・シークレットBOX
  { name: "bookmark_nodes", label: "ブックマーク" },
  { name: "secret_box_items", label: "シークレットBOX", blobColumns: ["data", "thumbnail"] },
  { name: "secret_box_folders", label: "BOXフォルダ" },
  // システム
  { name: "job_statuses", label: "ジョブ状態" },
  { name: "workflow_status", label: "ワークフロー状態" },
  { name: "analysis_cache", label: "分析キャッシュ" },  // v5.12
];

/**
 * テーブルのサイズを取得
 * BLOBカラムがある場合はそのサイズを合計、ない場合は推定サイズを計算
 */
async function getTableSize(tableName: string, blobColumns?: string[]): Promise<{ rowCount: number; size: number }> {
  try {
    // レコード数を取得
    const countResult = await db.all<{ count: number }>(
      sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`)
    );
    const rowCount = countResult[0]?.count ?? 0;

    if (rowCount === 0) {
      return { rowCount: 0, size: 0 };
    }

    // BLOBカラムがある場合は実サイズを計算
    if (blobColumns && blobColumns.length > 0) {
      const sizeExpressions = blobColumns.map(col => `COALESCE(SUM(LENGTH(${col})), 0)`).join(" + ");
      const sizeResult = await db.all<{ size: number }>(
        sql.raw(`SELECT (${sizeExpressions}) as size FROM ${tableName}`)
      );
      const blobSize = Number(sizeResult[0]?.size ?? 0);

      // BLOBサイズ + 推定行データサイズ（1行あたり約200バイトと仮定）
      const estimatedRowSize = rowCount * 200;
      return { rowCount, size: blobSize + estimatedRowSize };
    }

    // BLOBがない場合は行数から推定（1行あたり約500バイトと仮定）
    const estimatedSize = rowCount * 500;
    return { rowCount, size: estimatedSize };
  } catch (error) {
    logger.warn({ tableName, error }, "Failed to get table size");
    return { rowCount: 0, size: 0 };
  }
}

// GET /api/system/storage - ストレージ統計を取得
systemRoute.get("/storage", async (c) => {
  try {
    // DBファイルの全体サイズを取得
    const dbPath = path.join(__dirname, "../../../data.db");
    let totalSize = 0;

    try {
      const stats = fs.statSync(dbPath);
      totalSize = stats.size;
    } catch (e) {
      logger.warn({ dbPath, error: e }, "Failed to get DB file size");
    }

    // 各テーブルのサイズを取得
    const tables: TableInfo[] = [];

    for (const tableDef of TABLE_DEFINITIONS) {
      const { rowCount, size } = await getTableSize(tableDef.name, tableDef.blobColumns);
      tables.push({
        name: tableDef.name,
        label: tableDef.label,
        rowCount,
        size,
      });
    }

    // サイズ順にソート（降順）
    tables.sort((a, b) => b.size - a.size);

    const response: StorageResponse = {
      totalSize,
      tables,
    };

    return c.json(response);
  } catch (error) {
    logger.error({ error }, "Failed to get storage stats");
    return c.json({ error: "Failed to get storage stats" }, 500);
  }
});
