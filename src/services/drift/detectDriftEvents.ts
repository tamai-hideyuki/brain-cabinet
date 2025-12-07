/**
 * Drift Event 抽出サービス
 *
 * note_history の semantic_diff を分析し、
 * 思考の転換点を drift_events テーブルに記録する。
 *
 * threshold = 0.25 (バランス型)
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import {
  computeDriftScore,
  classifyDriftEvent,
  DRIFT_THRESHOLD,
  LARGE_DRIFT_THRESHOLD,
} from "./computeDriftScore";

export type DetectedDriftEvent = {
  noteId: string;
  semanticDiff: number;
  driftScore: number;
  eventType: "medium" | "large" | "cluster_shift";
  oldClusterId: number | null;
  newClusterId: number | null;
  detectedAt: number;
};

/**
 * 過去の全履歴からドリフトイベントを検出
 */
export async function detectAllDriftEvents(): Promise<DetectedDriftEvent[]> {
  console.log("🔍 Detecting drift events from note_history...");

  // note_history から semantic_diff >= threshold のレコードを取得
  const historyRows = await db.all<{
    note_id: string;
    semantic_diff: string;
    created_at: number;
  }>(sql`
    SELECT note_id, semantic_diff, created_at
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND CAST(semantic_diff AS REAL) >= ${DRIFT_THRESHOLD}
    ORDER BY created_at ASC
  `);

  console.log(`📊 History records with drift >= ${DRIFT_THRESHOLD}: ${historyRows.length}`);

  // クラスタ履歴を取得（note_id => cluster_id の時系列）
  const clusterHistoryRows = await db.all<{
    note_id: string;
    cluster_id: number;
    assigned_at: number;
  }>(sql`
    SELECT note_id, cluster_id, assigned_at
    FROM cluster_history
    ORDER BY assigned_at ASC
  `);

  // note_id ごとのクラスタ履歴をマップ化
  const clusterHistoryMap = new Map<string, Array<{ clusterId: number; assignedAt: number }>>();
  for (const row of clusterHistoryRows) {
    if (!clusterHistoryMap.has(row.note_id)) {
      clusterHistoryMap.set(row.note_id, []);
    }
    clusterHistoryMap.get(row.note_id)!.push({
      clusterId: row.cluster_id,
      assignedAt: row.assigned_at,
    });
  }

  const events: DetectedDriftEvent[] = [];

  for (const row of historyRows) {
    const semanticDiff = parseFloat(row.semantic_diff);
    if (isNaN(semanticDiff)) continue;

    // クラスタ変化を検出
    const clusterHistory = clusterHistoryMap.get(row.note_id) || [];
    let oldClusterId: number | null = null;
    let newClusterId: number | null = null;

    // このイベント時点でのクラスタを探す
    // 現時点では初期化時にしか履歴がないので、最新のクラスタIDを使用
    if (clusterHistory.length > 0) {
      newClusterId = clusterHistory[clusterHistory.length - 1].clusterId;
      if (clusterHistory.length > 1) {
        oldClusterId = clusterHistory[clusterHistory.length - 2].clusterId;
      }
    }

    const { driftScore, clusterJump } = computeDriftScore({
      semanticDiff,
      oldClusterId,
      newClusterId,
    });

    const eventType = classifyDriftEvent(semanticDiff, clusterJump);
    if (!eventType) continue;

    events.push({
      noteId: row.note_id,
      semanticDiff,
      driftScore,
      eventType,
      oldClusterId,
      newClusterId,
      detectedAt: row.created_at,
    });
  }

  console.log(`✅ Detected ${events.length} drift events`);
  return events;
}

/**
 * 検出したイベントを drift_events テーブルに保存
 */
export async function saveDriftEvents(events: DetectedDriftEvent[]): Promise<void> {
  console.log(`💾 Saving ${events.length} drift events to database...`);

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
        type = "cluster_bias"; // クラスタ移動
        break;
      case "large":
        type = "over_focus"; // 大きな変化
        break;
      case "medium":
      default:
        type = "drift_drop"; // 中程度の変化
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

  console.log(`✅ Saved ${events.length} drift events`);
}

/**
 * ドリフトイベントのメッセージを生成
 */
function generateDriftMessage(event: DetectedDriftEvent): string {
  const diffPercent = (event.semanticDiff * 100).toFixed(1);
  const scorePercent = (event.driftScore * 100).toFixed(1);

  if (event.eventType === "cluster_shift") {
    return `思考領域が移動しました（Cluster ${event.oldClusterId} → ${event.newClusterId}）。内容変化: ${diffPercent}%、ドリフトスコア: ${scorePercent}%`;
  }

  if (event.eventType === "large") {
    return `大きな思考の変化を検出しました。内容変化: ${diffPercent}%、ドリフトスコア: ${scorePercent}%`;
  }

  return `思考の変化を検出しました。内容変化: ${diffPercent}%、ドリフトスコア: ${scorePercent}%`;
}
