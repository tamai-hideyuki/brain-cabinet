/**
 * note_history の prev_cluster_id / new_cluster_id バックフィル
 *
 * 既存の履歴に対して、現在のノートのクラスタIDを new_cluster_id として設定。
 * prev_cluster_id は履歴がないため NULL のまま。
 */

import { db } from "../db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🚀 Backfilling cluster IDs in note_history...");

  // 既存の履歴でクラスタIDが未設定のものを取得
  const historyRows = await db.all<{
    id: string;
    note_id: string;
  }>(sql`
    SELECT id, note_id
    FROM note_history
    WHERE new_cluster_id IS NULL
  `);

  console.log(`📊 History records to backfill: ${historyRows.length}`);

  if (historyRows.length === 0) {
    console.log("✅ No records to backfill.");
    return;
  }

  // ノートIDごとのクラスタIDをキャッシュ
  const noteClusterMap = new Map<string, number | null>();

  const notes = await db.all<{
    id: string;
    cluster_id: number | null;
  }>(sql`
    SELECT id, cluster_id FROM notes
  `);

  for (const note of notes) {
    noteClusterMap.set(note.id, note.cluster_id);
  }

  let updated = 0;

  for (const row of historyRows) {
    const clusterId = noteClusterMap.get(row.note_id) ?? null;

    // new_cluster_id に現在のクラスタIDを設定
    // prev_cluster_id は履歴がないため NULL のまま
    await db.run(sql`
      UPDATE note_history
      SET new_cluster_id = ${clusterId}
      WHERE id = ${row.id}
    `);

    updated++;
  }

  console.log(`✅ Backfill completed!`);
  console.log(`   Updated: ${updated} records`);

  // 検証
  const stats = await db.all<{
    has_cluster: number;
    no_cluster: number;
  }>(sql`
    SELECT
      SUM(CASE WHEN new_cluster_id IS NOT NULL THEN 1 ELSE 0 END) as has_cluster,
      SUM(CASE WHEN new_cluster_id IS NULL THEN 1 ELSE 0 END) as no_cluster
    FROM note_history
  `);

  if (stats.length > 0) {
    console.log(`\n📈 Cluster ID coverage:`);
    console.log(`   With cluster ID:    ${stats[0].has_cluster}`);
    console.log(`   Without cluster ID: ${stats[0].no_cluster}`);
  }
}

main().catch(console.error);
