/**
 * Drift Events 再構築スクリプト (v3)
 *
 * note_history の全件を走査し、クラスタ遷移を考慮した
 * Drift Events を生成する。
 *
 * Drift Event 生成条件：
 * - semantic_diff >= 0.25 → 中ドリフト
 * - semantic_diff >= 0.50 → 大ドリフト
 * - cluster_id の変化 → 強制イベント化
 *
 * drift_score = semantic_diff × (1 + cluster_jump_bonus)
 * - ジャンプ時は +0.5
 */

import { db } from "../shared/db/client";
import { sql } from "drizzle-orm";
import {
  computeDriftScore,
  classifyDriftEvent,
  DRIFT_THRESHOLD,
  LARGE_DRIFT_THRESHOLD,
} from "../modules/drift/computeDriftScore";

type HistoryRow = {
  id: string;
  note_id: string;
  semantic_diff: string | null;
  prev_cluster_id: number | null;
  new_cluster_id: number | null;
  created_at: number;
};

type DriftEventRecord = {
  noteId: string;
  semanticDiff: number;
  driftScore: number;
  eventType: "medium" | "large" | "cluster_shift";
  prevClusterId: number | null;
  newClusterId: number | null;
  clusterJump: boolean;
  detectedAt: number;
};

async function main() {
  console.log("🚀 Rebuilding Drift Events (v3 with cluster transitions)...\n");

  // 既存の drift_events を削除
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM drift_events
  `);
  console.log(`📊 Existing drift_events: ${existingCount[0]?.count || 0}`);
  console.log(`   Clearing for fresh rebuild...\n`);
  await db.run(sql`DELETE FROM drift_events`);

  // note_history 全件取得（時系列順）
  const historyRows = await db.all<HistoryRow>(sql`
    SELECT
      id,
      note_id,
      semantic_diff,
      prev_cluster_id,
      new_cluster_id,
      created_at
    FROM note_history
    ORDER BY created_at ASC
  `);

  console.log(`📊 Total history records: ${historyRows.length}\n`);

  const events: DriftEventRecord[] = [];

  for (const row of historyRows) {
    // semantic_diff がない場合はスキップ
    if (!row.semantic_diff) continue;

    const semanticDiff = parseFloat(row.semantic_diff);
    if (isNaN(semanticDiff)) continue;

    // Drift Score 計算
    const { driftScore, clusterJump } = computeDriftScore({
      semanticDiff,
      oldClusterId: row.prev_cluster_id,
      newClusterId: row.new_cluster_id,
    });

    // イベントタイプ判定
    const eventType = classifyDriftEvent(semanticDiff, clusterJump);

    // 閾値以下かつクラスタジャンプなしならスキップ
    if (!eventType) continue;

    events.push({
      noteId: row.note_id,
      semanticDiff,
      driftScore,
      eventType,
      prevClusterId: row.prev_cluster_id,
      newClusterId: row.new_cluster_id,
      clusterJump,
      detectedAt: row.created_at,
    });
  }

  console.log(`✅ Detected ${events.length} drift events\n`);

  // drift_events に保存
  const now = Math.floor(Date.now() / 1000);

  for (const event of events) {
    // severity を driftScore から決定
    let severity: "low" | "mid" | "high";
    if (event.driftScore >= 0.5) {
      severity = "high";
    } else if (event.driftScore >= 0.3) {
      severity = "mid";
    } else {
      severity = "low";
    }

    // type をイベントタイプに応じて設定
    let type: string;
    switch (event.eventType) {
      case "cluster_shift":
        type = "cluster_bias";
        break;
      case "large":
        type = "over_focus";
        break;
      case "medium":
      default:
        type = "drift_drop";
        break;
    }

    // メッセージを生成
    const message = generateDriftMessage(event);

    await db.run(sql`
      INSERT INTO drift_events
        (detected_at, severity, type, message, related_cluster)
      VALUES
        (${event.detectedAt}, ${severity}, ${type}, ${message}, ${event.newClusterId})
    `);
  }

  // 結果サマリー
  console.log("=".repeat(60));
  console.log("📊 Drift Event Summary (v3)");
  console.log("=".repeat(60));

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

  // クラスタジャンプ集計
  const jumpCount = events.filter((e) => e.clusterJump).length;
  const noJumpCount = events.filter((e) => !e.clusterJump).length;
  console.log(`\n🔀 Cluster Transitions:`);
  console.log(`   With cluster jump:    ${jumpCount}`);
  console.log(`   Same cluster:         ${noJumpCount}`);

  // スコア統計
  if (events.length > 0) {
    const scores = events.map((e) => e.driftScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    console.log(`\n📈 Drift Score Statistics:`);
    console.log(`   Min:  ${(minScore * 100).toFixed(1)}%`);
    console.log(`   Max:  ${(maxScore * 100).toFixed(1)}%`);
    console.log(`   Avg:  ${(avgScore * 100).toFixed(1)}%`);
  }

  // 重要度別集計
  const severityCount = {
    high: events.filter((e) => e.driftScore >= 0.5).length,
    mid: events.filter((e) => e.driftScore >= 0.3 && e.driftScore < 0.5).length,
    low: events.filter((e) => e.driftScore < 0.3).length,
  };

  console.log(`\n🚨 By Severity:`);
  console.log(`   🔴 High (≥50%):  ${severityCount.high}`);
  console.log(`   🟡 Mid (30-50%): ${severityCount.mid}`);
  console.log(`   🟢 Low (<30%):   ${severityCount.low}`);

  // 最新5件のイベントを表示
  console.log(`\n📋 Recent Events (top 5):`);
  const recent = events.slice(-5).reverse();
  for (const event of recent) {
    const date = new Date(event.detectedAt * 1000).toISOString().split("T")[0];
    const jump = event.clusterJump ? `🔀 C${event.prevClusterId}→${event.newClusterId}` : `   C${event.newClusterId}`;
    console.log(
      `   ${date} | ${event.eventType.padEnd(14)} | diff: ${(event.semanticDiff * 100).toFixed(1).padStart(5)}% | score: ${(event.driftScore * 100).toFixed(1).padStart(5)}% | ${jump}`
    );
  }

  console.log("\n✅ Drift event rebuild completed!");
}

/**
 * ドリフトイベントのメッセージを生成
 */
function generateDriftMessage(event: DriftEventRecord): string {
  const diffPercent = (event.semanticDiff * 100).toFixed(1);
  const scorePercent = (event.driftScore * 100).toFixed(1);

  if (event.clusterJump) {
    return `思考領域が移動しました（Cluster ${event.prevClusterId} → ${event.newClusterId}）。内容変化: ${diffPercent}%、ドリフトスコア: ${scorePercent}%`;
  }

  if (event.eventType === "large") {
    return `大きな思考の変化を検出しました。内容変化: ${diffPercent}%、ドリフトスコア: ${scorePercent}%`;
  }

  return `思考の変化を検出しました。内容変化: ${diffPercent}%、ドリフトスコア: ${scorePercent}%`;
}

main().catch(console.error);
