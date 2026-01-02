/**
 * Temporal Clustering Types
 *
 * v7 時系列クラスタ追跡の型定義
 */

import type { SnapshotTrigger, ConfidenceLabel, ClusterEventType } from "../../../db/schema";

// ============================================================
// Core Types
// ============================================================

/** スナップショット内クラスタ情報 */
export interface SnapshotClusterInfo {
  id: number;                    // snapshot_clusters.id
  localId: number;               // 0〜k-1（スナップショット内ID）
  centroid: number[];            // Float32Array -> number[]
  centroidNorm: number;          // コサイン類似度計算高速化用
  size: number;
  sampleNoteId: string | null;
  cohesion: number | null;
  identityId: number | null;     // v7.1: 論理クラスタID
}

/** クラスタアイデンティティ（思考系譜の永続的な識別子） */
export interface ClusterIdentity {
  id: number;
  createdAt: number;
  label: string | null;
  description: string | null;
  isActive: boolean;
  lastSeenSnapshotId: number | null;
}

/** クラスタリングスナップショット */
export interface ClusteringSnapshot {
  id: number;
  prevSnapshotId: number | null;
  createdAt: number;             // Unix timestamp
  trigger: SnapshotTrigger;
  k: number;
  totalNotes: number;
  avgCohesion: number | null;
  isCurrent: boolean;
  changeScore: number | null;
  notesAdded: number;
  notesRemoved: number;
  clusters: SnapshotClusterInfo[];
}

/** predecessor判定結果 */
export interface LineageCandidate {
  predecessorClusterId: number | null;  // NULLなら新規クラスタ
  similarity: number;                    // predecessorとの類似度（0〜1）
  confidenceScore: number;               // 判定の確信度（0〜1）
  confidenceLabel: ConfidenceLabel;      // high/medium/low/none
}

/** クラスタ継承関係 */
export interface ClusterLineage {
  id: number;
  snapshotId: number;
  clusterId: number;             // 新クラスタ（snapshot_clusters.id）
  predecessorClusterId: number | null;
  similarity: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
}

// ============================================================
// Event Types
// ============================================================

/** 分裂イベント詳細 */
export interface SplitEventDetails {
  source: number;                // 元クラスタID（snapshot_clusters.id）
  targets: number[];             // 分裂先クラスタID[]
}

/** 統合イベント詳細 */
export interface MergeEventDetails {
  sources: number[];             // 統合元クラスタID[]
  target: number;                // 統合先クラスタID
}

/** 消滅イベント詳細 */
export interface ExtinctEventDetails {
  clusterId: number;             // 消滅したクラスタID
  lastSize: number;              // 最後のサイズ
}

/** 新規出現イベント詳細 */
export interface EmergeEventDetails {
  clusterId: number;             // 新規クラスタID
  initialSize: number;           // 初期サイズ
}

/** 継続イベント詳細 */
export interface ContinueEventDetails {
  from: number;                  // 元クラスタID
  to: number;                    // 新クラスタID
  similarity: number;            // 類似度
}

export type ClusterEventDetails =
  | SplitEventDetails
  | MergeEventDetails
  | ExtinctEventDetails
  | EmergeEventDetails
  | ContinueEventDetails;

/** クラスタイベント */
export interface ClusterEvent {
  id: number;
  snapshotId: number;
  eventType: ClusterEventType;
  createdAt: number;
  details: ClusterEventDetails;
}

// ============================================================
// Metrics Types
// ============================================================

/** 変化検出メトリクス */
export interface ChangeMetrics {
  avgCohesionDelta: number;      // 平均凝集度の変化
  clusterCountDelta: number;     // クラスタ数の変化
  notesAddedRatio: number;       // 追加ノート比率
  centroidDrift: number;         // 重心の平均移動量
}

/** スナップショット作成判定結果 */
export interface SnapshotDecision {
  should: boolean;
  trigger: SnapshotTrigger;
  metrics: ChangeMetrics;
}

// ============================================================
// Query Types
// ============================================================

/** クラスタタイムライン（1クラスタの時系列） */
export interface ClusterTimelineEntry {
  snapshotId: number;
  snapshotCreatedAt: number;
  clusterId: number;             // snapshot_clusters.id
  localId: number;
  size: number;
  cohesion: number | null;
  predecessorClusterId: number | null;
  similarity: number;
  confidenceLabel: ConfidenceLabel;
  event: ClusterEventType | null;
}

/** クラスタ系譜（predecessorを遡る） */
export interface ClusterLineageChain {
  current: SnapshotClusterInfo;
  predecessors: Array<{
    cluster: SnapshotClusterInfo;
    similarity: number;
    confidenceLabel: ConfidenceLabel;
    snapshotCreatedAt: number;
  }>;
}
