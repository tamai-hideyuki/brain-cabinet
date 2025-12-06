/**
 * metrics_time_series 初期化スクリプト
 *
 * 過去のノート作成/更新履歴から日次メトリクスを計算して保存。
 */

import { db } from "../db/client";
import { sql } from "drizzle-orm";

/**
 * エントロピーを計算（クラスタ分布の均等さ）
 * 値が高いほど分散している、低いほど偏っている
 */
function calcEntropy(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let entropy = 0;
  for (const count of counts) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }

  // 正規化（0〜1の範囲に）
  const maxEntropy = Math.log2(counts.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

async function main() {
  console.log("🚀 metrics_time_series initialization starting...");

  // 既存のメトリクス数を確認
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM metrics_time_series
  `);

  if (existingCount[0]?.count > 0) {
    console.log(
      `⚠️  metrics_time_series already has ${existingCount[0].count} records.`
    );
    console.log(`   Clearing existing data for fresh initialization...`);
    await db.run(sql`DELETE FROM metrics_time_series`);
  }

  // 全ての日付を取得（notes の created_at と updated_at から）
  const dates = await db.all<{ date: string }>(sql`
    SELECT DISTINCT date(created_at, 'unixepoch') as date FROM notes
    UNION
    SELECT DISTINCT date(updated_at, 'unixepoch') as date FROM notes
    ORDER BY date
  `);

  console.log(`📊 Dates to process: ${dates.length}`);

  // クラスタ数を取得
  const clusterCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(DISTINCT id) as count FROM clusters
  `);
  const numClusters = clusterCount[0]?.count || 8;

  const now = Math.floor(Date.now() / 1000);
  let processed = 0;

  for (const { date } of dates) {
    // その日のノート数
    const noteCountResult = await db.all<{ count: number }>(sql`
      SELECT COUNT(*) as count FROM notes
      WHERE date(created_at, 'unixepoch') = ${date}
         OR date(updated_at, 'unixepoch') = ${date}
    `);
    const noteCount = noteCountResult[0]?.count || 0;

    // その日の平均 semantic_diff（note_history から）
    const avgDiffResult = await db.all<{ avg_diff: number | null }>(sql`
      SELECT AVG(CAST(semantic_diff AS REAL)) as avg_diff
      FROM note_history
      WHERE date(created_at, 'unixepoch') = ${date}
        AND semantic_diff IS NOT NULL
    `);
    const avgSemanticDiff = avgDiffResult[0]?.avg_diff;

    // その日のクラスタ分布
    const clusterDist = await db.all<{ cluster_id: number; count: number }>(sql`
      SELECT cluster_id, COUNT(*) as count
      FROM notes
      WHERE cluster_id IS NOT NULL
        AND (date(created_at, 'unixepoch') = ${date}
         OR date(updated_at, 'unixepoch') = ${date})
      GROUP BY cluster_id
    `);

    // 最頻クラスタ
    let dominantCluster: number | null = null;
    let maxCount = 0;
    const clusterCounts = new Array(numClusters).fill(0);

    for (const { cluster_id, count } of clusterDist) {
      clusterCounts[cluster_id] = count;
      if (count > maxCount) {
        maxCount = count;
        dominantCluster = cluster_id;
      }
    }

    // エントロピー計算
    const entropy = calcEntropy(clusterCounts);

    // 保存
    await db.run(sql`
      INSERT INTO metrics_time_series
        (date, note_count, avg_semantic_diff, dominant_cluster, entropy, created_at)
      VALUES
        (${date}, ${noteCount}, ${avgSemanticDiff}, ${dominantCluster}, ${entropy}, ${now})
    `);

    processed++;
  }

  console.log(`✅ Initialization completed!`);
  console.log(`   Processed: ${processed} days`);

  // 直近5日のメトリクスを表示
  const recent = await db.all<{
    date: string;
    note_count: number;
    avg_semantic_diff: number | null;
    dominant_cluster: number | null;
    entropy: number | null;
  }>(sql`
    SELECT date, note_count, avg_semantic_diff, dominant_cluster, entropy
    FROM metrics_time_series
    ORDER BY date DESC
    LIMIT 5
  `);

  console.log(`\n📈 Recent metrics:`);
  console.log(`Date       | Notes | AvgDiff | Dominant | Entropy`);
  console.log(`-----------|-------|---------|----------|--------`);
  for (const row of recent) {
    console.log(
      `${row.date} | ${row.note_count.toString().padStart(5)} | ${
        row.avg_semantic_diff?.toFixed(3) || "  N/A"
      } | ${
        row.dominant_cluster !== null
          ? row.dominant_cluster.toString().padStart(8)
          : "     N/A"
      } | ${row.entropy?.toFixed(3) || "  N/A"}`
    );
  }
}

main().catch(console.error);
