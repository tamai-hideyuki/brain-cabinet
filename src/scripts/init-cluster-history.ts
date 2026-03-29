/**
 * cluster_history 初期化スクリプト
 *
 * 現在の notes.cluster_id を cluster_history に初期レコードとして保存。
 * 既存の履歴がある場合はスキップ。
 */

import { db } from "../shared/db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🚀 cluster_history initialization starting...");

  // 既存の履歴数を確認
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM cluster_history
  `);

  if (existingCount[0]?.count > 0) {
    console.log(
      `⚠️  cluster_history already has ${existingCount[0].count} records.`
    );
    console.log(`   Skipping initialization to preserve existing data.`);
    return;
  }

  // cluster_id が設定されている notes を取得
  const notes = await db.all<{
    id: string;
    cluster_id: number;
    created_at: number;
  }>(sql`
    SELECT id, cluster_id, created_at
    FROM notes
    WHERE cluster_id IS NOT NULL
  `);

  console.log(`📊 Notes with cluster_id: ${notes.length}`);

  if (notes.length === 0) {
    console.log(`⚠️  No notes with cluster_id found. Run clustering first.`);
    return;
  }

  // 一括挿入（バッチ処理）
  const now = Math.floor(Date.now() / 1000);

  for (const note of notes) {
    // assigned_at は現在時刻（初期化時点）とする
    // 本来はクラスタリング実行時刻を使うべきだが、履歴がないので現在時刻で代用
    await db.run(sql`
      INSERT INTO cluster_history (note_id, cluster_id, assigned_at)
      VALUES (${note.id}, ${note.cluster_id}, ${now})
    `);
  }

  console.log(`✅ Initialization completed!`);
  console.log(`   Inserted: ${notes.length} records`);

  // 検証
  const stats = await db.all<{
    cluster_id: number;
    count: number;
  }>(sql`
    SELECT cluster_id, COUNT(*) as count
    FROM cluster_history
    GROUP BY cluster_id
    ORDER BY cluster_id
  `);

  console.log(`\n📈 Cluster distribution:`);
  for (const { cluster_id, count } of stats) {
    console.log(`   Cluster ${cluster_id}: ${count} notes`);
  }
}

main().catch(console.error);
