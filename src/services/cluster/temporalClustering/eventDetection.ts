/**
 * Cluster Event Detection
 *
 * クラスタの分裂/統合/消滅/新規出現を検出するロジック
 *
 * イベントタイプ:
 * - split: 1つのpredecessorに複数の新クラスタが紐づく
 * - merge: 複数の旧クラスタが1つの新クラスタに収束（※実装時に詳細化）
 * - extinct: predecessorとして参照されなかった旧クラスタ
 * - emerge: predecessorなしの新クラスタ
 * - continue: 1対1の継承
 */

import type { ClusterEventType } from "../../../db/schema";
import type {
  LineageCandidate,
  SnapshotClusterInfo,
  ClusterEvent,
  SplitEventDetails,
  ExtinctEventDetails,
  EmergeEventDetails,
  ContinueEventDetails,
  ClusterEventDetails,
} from "./types";
import { groupByPredecessor } from "./predecessorDetection";

export interface DetectedEvent {
  eventType: ClusterEventType;
  details: ClusterEventDetails;
}

/**
 * クラスタイベントを検出
 *
 * @param lineages 新クラスタID -> predecessor判定結果
 * @param previousClusters 前スナップショットのクラスタ群
 * @param newClusters 新スナップショットのクラスタ群
 * @returns 検出されたイベント群
 */
export function detectClusterEvents(
  lineages: Map<number, LineageCandidate>,
  previousClusters: SnapshotClusterInfo[],
  newClusters: SnapshotClusterInfo[]
): DetectedEvent[] {
  const events: DetectedEvent[] = [];

  // predecessorごとに新クラスタをグループ化
  const predecessorToNew = groupByPredecessor(lineages);

  // 参照されたpredecessor IDを記録
  const referencedPredecessors = new Set<number>();

  // 分裂・継続の検出
  for (const [predId, newClusterIds] of predecessorToNew) {
    if (predId === null) {
      // predecessorなし = 新規出現
      for (const newClusterId of newClusterIds) {
        const newCluster = newClusters.find((c) => c.id === newClusterId);
        events.push({
          eventType: "emerge",
          details: {
            clusterId: newClusterId,
            initialSize: newCluster?.size ?? 0,
          } as EmergeEventDetails,
        });
      }
    } else {
      referencedPredecessors.add(predId);

      if (newClusterIds.length > 1) {
        // 分裂: 1つのpredecessorに複数の新クラスタ
        events.push({
          eventType: "split",
          details: {
            source: predId,
            targets: newClusterIds,
          } as SplitEventDetails,
        });
      } else {
        // 継続: 1対1の継承
        const lineage = lineages.get(newClusterIds[0]);
        events.push({
          eventType: "continue",
          details: {
            from: predId,
            to: newClusterIds[0],
            similarity: lineage?.similarity ?? 0,
          } as ContinueEventDetails,
        });
      }
    }
  }

  // 消滅の検出: predecessorとして参照されなかった旧クラスタ
  for (const oldCluster of previousClusters) {
    if (!referencedPredecessors.has(oldCluster.id)) {
      events.push({
        eventType: "extinct",
        details: {
          clusterId: oldCluster.id,
          lastSize: oldCluster.size,
        } as ExtinctEventDetails,
      });
    }
  }

  // TODO: 統合（merge）の検出
  // 統合は「複数の旧クラスタが1つの新クラスタに収束」
  // これはlineageを逆引きして、同じnewClusterIdに対して
  // 複数のpredecessorが高類似度で関連している場合を検出する必要がある
  // v7.1で実装予定

  return events;
}

/**
 * イベントのサマリーを生成（ログ/UI用）
 */
export function summarizeEvents(events: DetectedEvent[]): {
  split: number;
  merge: number;
  extinct: number;
  emerge: number;
  continue: number;
} {
  const summary = {
    split: 0,
    merge: 0,
    extinct: 0,
    emerge: 0,
    continue: 0,
  };

  for (const event of events) {
    summary[event.eventType]++;
  }

  return summary;
}

/**
 * イベントを人間可読な形式に変換
 */
export function formatEvent(event: DetectedEvent): string {
  switch (event.eventType) {
    case "split": {
      const d = event.details as SplitEventDetails;
      return `Split: Cluster ${d.source} -> [${d.targets.join(", ")}]`;
    }
    case "extinct": {
      const d = event.details as ExtinctEventDetails;
      return `Extinct: Cluster ${d.clusterId} (size: ${d.lastSize})`;
    }
    case "emerge": {
      const d = event.details as EmergeEventDetails;
      return `Emerge: New cluster ${d.clusterId} (size: ${d.initialSize})`;
    }
    case "continue": {
      const d = event.details as ContinueEventDetails;
      return `Continue: Cluster ${d.from} -> ${d.to} (similarity: ${d.similarity.toFixed(3)})`;
    }
    case "merge": {
      // TODO: v7.1で実装
      return `Merge: (details pending)`;
    }
    default:
      return `Unknown event: ${event.eventType}`;
  }
}
