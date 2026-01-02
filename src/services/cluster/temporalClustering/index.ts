/**
 * Temporal Clustering Service
 *
 * v7 時系列クラスタ追跡のメインサービス
 *
 * 設計原則:
 * - append-only（修正は新規追加で表現）
 * - clustersテーブルは「current view」として維持
 * - snapshot系テーブルで履歴管理
 */

import { db } from "../../../db/client";
import { sql } from "drizzle-orm";
import {
  bufferToFloat32Array,
  float32ArrayToBuffer,
  cosineSimilarity,
  meanVector,
  normalizeVector,
  round4,
} from "../../../utils/math";
import { logger } from "../../../utils/logger";
import type { SnapshotTrigger } from "../../../db/schema";
import type {
  ClusteringSnapshot,
  SnapshotClusterInfo,
  ClusterLineage,
  ClusterEvent,
  ChangeMetrics,
} from "./types";
import {
  determinePredecessor,
  determineAllPredecessors,
} from "./predecessorDetection";
import { detectClusterEvents, summarizeEvents, formatEvent, DetectedEvent } from "./eventDetection";
import {
  computeChangeMetrics,
  shouldCreateSnapshot,
  getDaysSinceLastSnapshot,
  computeChangeScore,
} from "./snapshotDecision";
import { assignIdentities } from "./identityAssignment";

// Re-export types
export * from "./types";
export { determinePredecessor, determineAllPredecessors } from "./predecessorDetection";
export { detectClusterEvents, summarizeEvents } from "./eventDetection";
export { shouldCreateSnapshot, computeChangeMetrics } from "./snapshotDecision";
export {
  assignIdentities,
  listIdentities,
  setIdentityLabel,
  getIdentityTimeline,
} from "./identityAssignment";

// ============================================================
// Core Operations
// ============================================================

/**
 * 新しいクラスタリングスナップショットを作成
 *
 * @param clusterInfos K-Meansの結果（centroid, size, sampleNoteId）
 * @param noteAssignments ノートID -> クラスタID のマッピング
 * @param trigger スナップショット作成のトリガー
 * @returns 作成されたスナップショット
 */
export async function createClusteringSnapshot(
  clusterInfos: Array<{
    id: number;
    centroid: number[];
    size: number;
    sampleNoteId: string | null;
  }>,
  noteAssignments: Array<{ noteId: string; clusterId: number }>,
  trigger: SnapshotTrigger
): Promise<ClusteringSnapshot> {
  const now = Math.floor(Date.now() / 1000);

  // 前のスナップショットを取得
  const previousSnapshot = await getCurrentSnapshot();
  const previousClusters = previousSnapshot?.clusters ?? [];

  // 新クラスタ情報を構築
  const newClusters: SnapshotClusterInfo[] = clusterInfos.map((c) => {
    const centroidNorm = Math.sqrt(c.centroid.reduce((sum, v) => sum + v * v, 0));

    // cohesionを計算（そのクラスタに属するノートの平均類似度）
    const memberNoteIds = noteAssignments
      .filter((a) => a.clusterId === c.id)
      .map((a) => a.noteId);

    return {
      id: 0, // DBに保存後に設定
      localId: c.id,
      centroid: c.centroid,
      centroidNorm,
      size: c.size,
      sampleNoteId: c.sampleNoteId,
      cohesion: null, // 後で計算
      identityId: null, // identity割り当て後に設定
    };
  });

  // 変化メトリクスを計算
  const totalNotes = noteAssignments.length;
  const previousTotalNotes = previousSnapshot?.totalNotes ?? 0;
  const metrics = computeChangeMetrics(
    newClusters,
    previousClusters,
    totalNotes,
    previousTotalNotes
  );
  const changeScore = computeChangeScore(metrics);

  // 平均凝集度を計算
  const avgCohesion = newClusters.reduce(
    (sum, c) => sum + (c.cohesion ?? 0),
    0
  ) / (newClusters.length || 1);

  // トランザクションで保存
  return await db.transaction(async (tx) => {
    // 1. 既存のis_currentをリセット
    await tx.run(sql`UPDATE clustering_snapshots SET is_current = 0 WHERE is_current = 1`);

    // 2. 新スナップショットを挿入
    const snapshotResult = await tx.run(sql`
      INSERT INTO clustering_snapshots (
        prev_snapshot_id, created_at, trigger, k, total_notes,
        avg_cohesion, is_current, change_score, notes_added, notes_removed
      ) VALUES (
        ${previousSnapshot?.id ?? null},
        ${now},
        ${trigger},
        ${clusterInfos.length},
        ${totalNotes},
        ${round4(avgCohesion)},
        1,
        ${changeScore},
        ${Math.max(0, totalNotes - previousTotalNotes)},
        ${Math.max(0, previousTotalNotes - totalNotes)}
      )
    `);

    const snapshotId = Number(snapshotResult.lastInsertRowid);

    // 3. クラスタを挿入
    const insertedClusters: SnapshotClusterInfo[] = [];
    for (const cluster of newClusters) {
      const centroidBuffer = float32ArrayToBuffer(cluster.centroid);
      const clusterResult = await tx.run(sql`
        INSERT INTO snapshot_clusters (
          snapshot_id, local_id, centroid, centroid_norm, size, sample_note_id, cohesion
        ) VALUES (
          ${snapshotId},
          ${cluster.localId},
          ${centroidBuffer},
          ${cluster.centroidNorm},
          ${cluster.size},
          ${cluster.sampleNoteId},
          ${cluster.cohesion}
        )
      `);

      insertedClusters.push({
        ...cluster,
        id: Number(clusterResult.lastInsertRowid),
      });
    }

    // 4. ノート割り当てを挿入
    for (const assignment of noteAssignments) {
      const cluster = insertedClusters.find((c) => c.localId === assignment.clusterId);
      if (cluster) {
        await tx.run(sql`
          INSERT INTO snapshot_note_assignments (snapshot_id, note_id, cluster_id)
          VALUES (${snapshotId}, ${assignment.noteId}, ${cluster.id})
        `);
      }
    }

    // 5. predecessor判定
    const lineages = determineAllPredecessors(insertedClusters, previousClusters);

    // 6. lineageを保存
    for (const [newClusterId, lineage] of lineages) {
      await tx.run(sql`
        INSERT INTO cluster_lineage (
          snapshot_id, cluster_id, predecessor_cluster_id,
          similarity, confidence_score, confidence_label
        ) VALUES (
          ${snapshotId},
          ${newClusterId},
          ${lineage.predecessorClusterId},
          ${lineage.similarity},
          ${lineage.confidenceScore},
          ${lineage.confidenceLabel}
        )
      `);
    }

    // 7. イベント検出・保存
    const events = detectClusterEvents(lineages, previousClusters, insertedClusters);
    for (const event of events) {
      await tx.run(sql`
        INSERT INTO cluster_events (snapshot_id, event_type, created_at, details)
        VALUES (${snapshotId}, ${event.eventType}, ${now}, ${JSON.stringify(event.details)})
      `);
    }

    // 8. v7.1: クラスタアイデンティティの割り当て
    await assignIdentities(tx, snapshotId, insertedClusters, lineages, previousClusters);

    // ログ出力
    const eventSummary = summarizeEvents(events);
    logger.info(
      {
        snapshotId,
        trigger,
        k: clusterInfos.length,
        totalNotes,
        changeScore,
        events: eventSummary,
      },
      "[TemporalClustering] Created snapshot"
    );

    // 詳細なイベントログ
    for (const event of events) {
      logger.debug({ event: formatEvent(event) }, "[TemporalClustering] Event detected");
    }

    return {
      id: snapshotId,
      prevSnapshotId: previousSnapshot?.id ?? null,
      createdAt: now,
      trigger,
      k: clusterInfos.length,
      totalNotes,
      avgCohesion: round4(avgCohesion),
      isCurrent: true,
      changeScore,
      notesAdded: Math.max(0, totalNotes - previousTotalNotes),
      notesRemoved: Math.max(0, previousTotalNotes - totalNotes),
      clusters: insertedClusters,
    };
  });
}

// ============================================================
// Query Operations
// ============================================================

/**
 * 現在のスナップショットを取得
 */
export async function getCurrentSnapshot(): Promise<ClusteringSnapshot | null> {
  const rows = await db.all<{
    id: number;
    prev_snapshot_id: number | null;
    created_at: number;
    trigger: string;
    k: number;
    total_notes: number;
    avg_cohesion: number | null;
    is_current: number;
    change_score: number | null;
    notes_added: number;
    notes_removed: number;
  }>(sql`
    SELECT * FROM clustering_snapshots
    WHERE is_current = 1
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (rows.length === 0) return null;
  const snapshot = rows[0];

  const clusters = await getSnapshotClusters(snapshot.id);

  return {
    id: snapshot.id,
    prevSnapshotId: snapshot.prev_snapshot_id,
    createdAt: snapshot.created_at,
    trigger: snapshot.trigger as SnapshotTrigger,
    k: snapshot.k,
    totalNotes: snapshot.total_notes,
    avgCohesion: snapshot.avg_cohesion,
    isCurrent: snapshot.is_current === 1,
    changeScore: snapshot.change_score,
    notesAdded: snapshot.notes_added,
    notesRemoved: snapshot.notes_removed,
    clusters,
  };
}

/**
 * スナップショットのクラスタを取得
 */
export async function getSnapshotClusters(snapshotId: number): Promise<SnapshotClusterInfo[]> {
  const rows = await db.all<{
    id: number;
    snapshot_id: number;
    local_id: number;
    centroid: Buffer;
    centroid_norm: number | null;
    size: number;
    sample_note_id: string | null;
    cohesion: number | null;
    identity_id: number | null;
  }>(sql`
    SELECT * FROM snapshot_clusters
    WHERE snapshot_id = ${snapshotId}
    ORDER BY local_id
  `);

  return rows.map((row) => ({
    id: row.id,
    localId: row.local_id,
    centroid: bufferToFloat32Array(row.centroid),
    centroidNorm: row.centroid_norm ?? 0,
    size: row.size,
    sampleNoteId: row.sample_note_id,
    cohesion: row.cohesion,
    identityId: row.identity_id,
  }));
}

/**
 * スナップショット一覧を取得
 */
export async function listSnapshots(limit: number = 50): Promise<ClusteringSnapshot[]> {
  const snapshots = await db.all<{
    id: number;
    prev_snapshot_id: number | null;
    created_at: number;
    trigger: string;
    k: number;
    total_notes: number;
    avg_cohesion: number | null;
    is_current: number;
    change_score: number | null;
    notes_added: number;
    notes_removed: number;
  }>(sql`
    SELECT * FROM clustering_snapshots
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  const results: ClusteringSnapshot[] = [];
  for (const snapshot of snapshots) {
    const clusters = await getSnapshotClusters(snapshot.id);
    results.push({
      id: snapshot.id,
      prevSnapshotId: snapshot.prev_snapshot_id,
      createdAt: snapshot.created_at,
      trigger: snapshot.trigger as SnapshotTrigger,
      k: snapshot.k,
      totalNotes: snapshot.total_notes,
      avgCohesion: snapshot.avg_cohesion,
      isCurrent: snapshot.is_current === 1,
      changeScore: snapshot.change_score,
      notesAdded: snapshot.notes_added,
      notesRemoved: snapshot.notes_removed,
      clusters,
    });
  }

  return results;
}

/** タイムラインエントリ */
interface TimelineEntry {
  snapshotId: number;
  snapshotCreatedAt: number;
  cluster: SnapshotClusterInfo;
  similarity: number;
  confidenceLabel: string;
}

/**
 * 単一クラスタの情報を取得（ヘルパー関数）
 */
async function fetchClusterInfo(clusterId: number): Promise<{
  cluster: SnapshotClusterInfo;
  snapshotCreatedAt: number;
  predecessorClusterId: number | null;
  similarity: number;
  confidenceLabel: string;
} | null> {
  const clusterRows = await db.all<{
    id: number;
    snapshot_id: number;
    local_id: number;
    centroid: Buffer;
    centroid_norm: number | null;
    size: number;
    sample_note_id: string | null;
    cohesion: number | null;
    identity_id: number | null;
  }>(sql`SELECT * FROM snapshot_clusters WHERE id = ${clusterId}`);

  if (clusterRows.length === 0) return null;
  const clusterRow = clusterRows[0];

  const snapshotRows = await db.all<{ created_at: number }>(
    sql`SELECT created_at FROM clustering_snapshots WHERE id = ${clusterRow.snapshot_id}`
  );

  const lineageRows = await db.all<{
    predecessor_cluster_id: number | null;
    similarity: number;
    confidence_label: string;
  }>(sql`
    SELECT predecessor_cluster_id, similarity, confidence_label
    FROM cluster_lineage
    WHERE cluster_id = ${clusterId}
  `);

  return {
    cluster: {
      id: clusterRow.id,
      localId: clusterRow.local_id,
      centroid: bufferToFloat32Array(clusterRow.centroid),
      centroidNorm: clusterRow.centroid_norm ?? 0,
      size: clusterRow.size,
      sampleNoteId: clusterRow.sample_note_id,
      cohesion: clusterRow.cohesion,
      identityId: clusterRow.identity_id,
    },
    snapshotCreatedAt: snapshotRows[0]?.created_at ?? 0,
    predecessorClusterId: lineageRows[0]?.predecessor_cluster_id ?? null,
    similarity: lineageRows[0]?.similarity ?? 0,
    confidenceLabel: lineageRows[0]?.confidence_label ?? "none",
  };
}

/**
 * 特定クラスタの系譜（タイムライン）を取得
 */
export async function getClusterTimeline(
  snapshotClusterId: number,
  maxDepth: number = 20
): Promise<TimelineEntry[]> {
  const timeline: TimelineEntry[] = [];
  let currentClusterId: number | null = snapshotClusterId;
  let depth = 0;

  while (currentClusterId !== null && depth < maxDepth) {
    const info = await fetchClusterInfo(currentClusterId);
    if (!info) break;

    timeline.push({
      snapshotId: info.cluster.id, // snapshot_clusters.id
      snapshotCreatedAt: info.snapshotCreatedAt,
      cluster: info.cluster,
      similarity: info.similarity,
      confidenceLabel: info.confidenceLabel,
    });

    currentClusterId = info.predecessorClusterId;
    depth++;
  }

  return timeline;
}

/**
 * スナップショットのイベントを取得
 */
export async function getSnapshotEvents(snapshotId: number): Promise<ClusterEvent[]> {
  const rows = await db.all<{
    id: number;
    snapshot_id: number;
    event_type: string;
    created_at: number;
    details: string;
  }>(sql`
    SELECT * FROM cluster_events
    WHERE snapshot_id = ${snapshotId}
    ORDER BY id
  `);

  return rows.map((row) => ({
    id: row.id,
    snapshotId: row.snapshot_id,
    eventType: row.event_type as any,
    createdAt: row.created_at,
    details: JSON.parse(row.details),
  }));
}

// ============================================================
// Integration with cluster-worker
// ============================================================

/**
 * クラスタリング実行後にスナップショットを作成するか判定
 * （cluster-workerから呼び出される）
 */
export async function maybeCreateSnapshot(
  clusterInfos: Array<{
    id: number;
    centroid: number[];
    size: number;
    sampleNoteId: string | null;
  }>,
  noteAssignments: Array<{ noteId: string; clusterId: number }>,
  forceCreate: boolean = false
): Promise<ClusteringSnapshot | null> {
  // 初回スナップショットの場合
  const previousSnapshot = await getCurrentSnapshot();
  if (!previousSnapshot) {
    logger.info("[TemporalClustering] Creating initial snapshot");
    return createClusteringSnapshot(clusterInfos, noteAssignments, "initial");
  }

  // 強制作成フラグがある場合
  if (forceCreate) {
    return createClusteringSnapshot(clusterInfos, noteAssignments, "manual");
  }

  // 変化判定
  const newClusters: SnapshotClusterInfo[] = clusterInfos.map((c, i) => ({
    id: i, // 仮ID
    localId: c.id,
    centroid: c.centroid,
    centroidNorm: Math.sqrt(c.centroid.reduce((sum, v) => sum + v * v, 0)),
    size: c.size,
    sampleNoteId: c.sampleNoteId,
    cohesion: null,
    identityId: null,
  }));

  const metrics = computeChangeMetrics(
    newClusters,
    previousSnapshot.clusters,
    noteAssignments.length,
    previousSnapshot.totalNotes
  );

  const daysSince = await getDaysSinceLastSnapshot();
  const decision = shouldCreateSnapshot(metrics, daysSince);

  if (decision.should) {
    logger.info(
      { trigger: decision.trigger, metrics: decision.metrics },
      "[TemporalClustering] Creating snapshot based on decision"
    );
    return createClusteringSnapshot(clusterInfos, noteAssignments, decision.trigger);
  }

  logger.debug(
    { metrics, daysSince },
    "[TemporalClustering] Skipping snapshot creation (no significant change)"
  );
  return null;
}
