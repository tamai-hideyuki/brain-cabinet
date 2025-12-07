/**
 * Drift Event 抽出実行スクリプト
 *
 * 過去の note_history から drift events を検出し、
 * drift_events テーブルに保存する。
 */

import {
  detectAllDriftEvents,
  saveDriftEvents,
} from "../services/drift/detectDriftEvents";
import { db } from "../db/client";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🚀 Drift Event Detection starting...\n");

  // 既存のイベント数を確認
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM drift_events
  `);

  if (existingCount[0]?.count > 0) {
    console.log(`⚠️  drift_events already has ${existingCount[0].count} records.`);
    console.log(`   Clearing existing data for fresh detection...\n`);
    await db.run(sql`DELETE FROM drift_events`);
  }

  // ドリフトイベントを検出
  const events = await detectAllDriftEvents();

  if (events.length === 0) {
    console.log("\n⚠️  No drift events detected.");
    console.log("   This may happen if:");
    console.log("   - note_history has no records with semantic_diff >= 0.25");
    console.log("   - All notes are new and have no edit history");
    return;
  }

  // イベントを保存
  await saveDriftEvents(events);

  // 結果サマリー
  console.log("\n" + "=".repeat(50));
  console.log("📊 Drift Event Summary");
  console.log("=".repeat(50));

  // イベントタイプ別集計
  const typeCount = {
    medium: events.filter((e) => e.eventType === "medium").length,
    large: events.filter((e) => e.eventType === "large").length,
    cluster_shift: events.filter((e) => e.eventType === "cluster_shift").length,
  };

  console.log(`\n📈 By Event Type:`);
  console.log(`   Medium drift (0.25-0.50):    ${typeCount.medium}`);
  console.log(`   Large drift (≥0.50):         ${typeCount.large}`);
  console.log(`   Cluster shift:               ${typeCount.cluster_shift}`);

  // スコア統計
  const scores = events.map((e) => e.driftScore);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  console.log(`\n📈 Drift Score Statistics:`);
  console.log(`   Min:  ${(minScore * 100).toFixed(1)}%`);
  console.log(`   Max:  ${(maxScore * 100).toFixed(1)}%`);
  console.log(`   Avg:  ${(avgScore * 100).toFixed(1)}%`);

  // 最新のイベントを表示
  console.log(`\n📋 Recent Events (top 5):`);
  const recent = events.slice(-5).reverse();
  for (const event of recent) {
    const date = new Date(event.detectedAt * 1000).toISOString().split("T")[0];
    console.log(
      `   ${date} | ${event.eventType.padEnd(14)} | diff: ${(event.semanticDiff * 100).toFixed(1)}% | score: ${(event.driftScore * 100).toFixed(1)}%`
    );
  }

  console.log("\n✅ Drift detection completed!");
}

main().catch(console.error);
