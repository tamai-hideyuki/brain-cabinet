/**
 * Drift Events 再構築サービス
 *
 * note_history の全件を走査し、クラスタ遷移を考慮した
 * Drift Events を生成する。
 *
 * 元スクリプト: src/scripts/rebuild-drift-events.ts をサービス化
 */

import * as driftRepo from "../../repositories/driftRepo";
import {
  computeDriftScore,
  classifyDriftEvent,
} from "./computeDriftScore";

type HistoryRow = driftRepo.NoteHistoryForRebuildRow;

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

export type RebuildDriftEventsResult = {
  cleared: number;
  detected: number;
  inserted: number;
  byType: {
    medium: number;
    large: number;
    clusterShift: number;
  };
  bySeverity: {
    high: number;
    mid: number;
    low: number;
  };
};

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

/**
 * Drift Events を再構築
 */
export async function rebuildDriftEvents(): Promise<RebuildDriftEventsResult> {
  // 既存の drift_events を削除
  const cleared = await driftRepo.countDriftEvents();

  await driftRepo.deleteAllDriftEvents();

  // note_history 全件取得（時系列順）
  const historyRows = await driftRepo.findAllNoteHistory();

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

  // drift_events に保存
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

    await driftRepo.insertDriftEventWithMessage(
      event.detectedAt,
      severity,
      type,
      message,
      event.newClusterId
    );
  }

  // 結果集計
  const byType = {
    medium: events.filter((e) => e.eventType === "medium").length,
    large: events.filter((e) => e.eventType === "large").length,
    clusterShift: events.filter((e) => e.eventType === "cluster_shift").length,
  };

  const bySeverity = {
    high: events.filter((e) => e.driftScore >= 0.5).length,
    mid: events.filter((e) => e.driftScore >= 0.3 && e.driftScore < 0.5).length,
    low: events.filter((e) => e.driftScore < 0.3).length,
  };

  return {
    cleared,
    detected: events.length,
    inserted: events.length,
    byType,
    bySeverity,
  };
}
