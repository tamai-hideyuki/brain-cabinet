/**
 * Weekly Report Generator
 *
 * 週次レポートを生成するサービス
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import {
  WeeklyReport,
  ThinkingPhase,
  ClusterGrowth,
  EventSummary,
  Perspective,
  PERSPECTIVES,
  PERSPECTIVE_LABELS,
} from "./types";
import { generatePerspectiveQuestions } from "./perspectiveQuestions";
import { generateWeeklyChallenge } from "./challengeGenerator";

// 1週間の秒数
const WEEK_SECONDS = 7 * 24 * 60 * 60;

/**
 * 週次レポートを生成
 */
export async function generateWeeklyReport(
  targetDate?: Date
): Promise<WeeklyReport> {
  const now = targetDate ? Math.floor(targetDate.getTime() / 1000) : Math.floor(Date.now() / 1000);
  const weekStart = now - WEEK_SECONDS;

  // 期間内のスナップショットを取得
  const snapshots = await db.all<{
    id: number;
    created_at: number;
    trigger: string;
    k: number;
    total_notes: number;
    avg_cohesion: number | null;
    change_score: number | null;
    notes_added: number;
    notes_removed: number;
  }>(sql`
    SELECT * FROM clustering_snapshots
    WHERE created_at >= ${weekStart} AND created_at <= ${now}
    ORDER BY created_at DESC
  `);

  // 現在のスナップショット
  const currentSnapshots = await db.all<{
    id: number;
    total_notes: number;
    avg_cohesion: number | null;
    change_score: number | null;
    notes_added: number;
  }>(sql`
    SELECT * FROM clustering_snapshots
    WHERE is_current = 1
    LIMIT 1
  `);
  const currentSnapshot = currentSnapshots[0] ?? null;

  // 週の開始時点のスナップショット（比較用）
  const weekStartSnapshots = await db.all<{
    id: number;
    total_notes: number;
    avg_cohesion: number | null;
  }>(sql`
    SELECT * FROM clustering_snapshots
    WHERE created_at <= ${weekStart}
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const weekStartSnapshot = weekStartSnapshots[0] ?? null;

  // イベントを取得
  const events = await getEventsInPeriod(weekStart, now);

  // クラスタ成長を計算
  const clusterGrowths = await calculateClusterGrowths(
    weekStartSnapshot?.id ?? null,
    currentSnapshot?.id ?? null
  );

  // 思考フェーズを判定
  const phaseInfo = await determineThinkingPhase(weekStart, now);

  // 偏りを検出
  const biasAlert = await detectBias(currentSnapshot?.id ?? null);

  // 空白領域を検出
  const blindSpots = await detectBlindSpots(now);

  // 新しく生まれた思考
  const newThoughts = await getNewThoughts(weekStart, now);

  // 収束した思考
  const extinctThoughts = await getExtinctThoughts(weekStart, now);

  // 視点分布を取得（フェーズ2）
  const perspectiveDistribution = await getPerspectiveDistribution(weekStart, now);

  // 他者視点からの問いを生成（フェーズ1.5）
  const topGrowthLabels = clusterGrowths
    .slice(0, 3)
    .map((g) => g.label)
    .filter((l): l is string => l !== null);
  const perspectiveQuestions = generatePerspectiveQuestions(
    topGrowthLabels,
    perspectiveDistribution
  );

  // 週次チャレンジを生成（フェーズ2.5）
  const weeklyChallenge = generateWeeklyChallenge(perspectiveDistribution);

  return {
    periodStart: weekStart,
    periodEnd: now,

    forest: {
      currentPhase: phaseInfo.current,
      phaseTransition: phaseInfo.transition,
      biasAlert,
      blindSpots,
      totalNotes: currentSnapshot?.total_notes ?? 0,
      notesAdded: snapshots.reduce((sum, s) => sum + s.notes_added, 0),
      avgCohesion: currentSnapshot?.avg_cohesion ?? null,
      changeScore: currentSnapshot?.change_score ?? null,
    },

    trees: {
      topGrowth: clusterGrowths.slice(0, 5),
      events: summarizeEvents(events),
      newThoughts,
      extinctThoughts,
    },

    perspectiveQuestions,
    perspectiveDistribution,
    weeklyChallenge,
  };
}

/**
 * 期間内のイベントを取得
 */
async function getEventsInPeriod(
  startTime: number,
  endTime: number
): Promise<Array<{ event_type: string; details: string }>> {
  const rows = await db.all<{
    event_type: string;
    details: string;
  }>(sql`
    SELECT ce.event_type, ce.details
    FROM cluster_events ce
    JOIN clustering_snapshots cs ON ce.snapshot_id = cs.id
    WHERE cs.created_at >= ${startTime} AND cs.created_at <= ${endTime}
  `);

  return rows;
}

/**
 * クラスタ成長を計算
 */
async function calculateClusterGrowths(
  startSnapshotId: number | null,
  endSnapshotId: number | null
): Promise<ClusterGrowth[]> {
  if (!endSnapshotId) return [];

  // 現在のクラスタ情報を取得
  const currentClusters = await db.all<{
    id: number;
    size: number;
    cohesion: number | null;
    identity_id: number | null;
  }>(sql`
    SELECT sc.id, sc.size, sc.cohesion, sc.identity_id
    FROM snapshot_clusters sc
    WHERE sc.snapshot_id = ${endSnapshotId}
  `);

  // アイデンティティのラベルを取得
  const identities = await db.all<{
    id: number;
    label: string | null;
  }>(sql`SELECT id, label FROM cluster_identities`);

  const identityLabels = new Map(identities.map((i) => [i.id, i.label]));

  // 開始時点のクラスタ情報を取得
  let startClusterMap = new Map<number, { size: number; cohesion: number | null }>();
  if (startSnapshotId) {
    const startClusters = await db.all<{
      identity_id: number | null;
      size: number;
      cohesion: number | null;
    }>(sql`
      SELECT sc.identity_id, sc.size, sc.cohesion
      FROM snapshot_clusters sc
      WHERE sc.snapshot_id = ${startSnapshotId}
    `);

    for (const c of startClusters) {
      if (c.identity_id) {
        startClusterMap.set(c.identity_id, { size: c.size, cohesion: c.cohesion });
      }
    }
  }

  // 成長を計算
  const growths: ClusterGrowth[] = [];
  for (const cluster of currentClusters) {
    if (!cluster.identity_id) continue;

    const startInfo = startClusterMap.get(cluster.identity_id);
    const startSize = startInfo?.size ?? 0;
    const startCohesion = startInfo?.cohesion ?? 0;

    growths.push({
      identityId: cluster.identity_id,
      label: identityLabels.get(cluster.identity_id) ?? null,
      notesDelta: cluster.size - startSize,
      cohesionDelta: (cluster.cohesion ?? 0) - startCohesion,
      currentSize: cluster.size,
      currentCohesion: cluster.cohesion,
    });
  }

  // ノート増加数でソート
  return growths.sort((a, b) => b.notesDelta - a.notesDelta);
}

/**
 * 思考フェーズを判定
 */
async function determineThinkingPhase(
  startTime: number,
  endTime: number
): Promise<{
  current: ThinkingPhase;
  transition: { from: ThinkingPhase | null; to: ThinkingPhase } | null;
}> {
  // ノートの特性から判定
  // - 新規ノートが多い → 探索
  // - 関連付けが増えている → 構造化
  // - 特定クラスタに集中 → 実装
  // - 編集が多く新規が少ない → 振り返り

  const statsRows = await db.all<{
    new_notes: number;
    edited_notes: number;
    total_notes: number;
  }>(sql`
    SELECT
      COUNT(CASE WHEN created_at >= ${startTime} THEN 1 END) as new_notes,
      COUNT(CASE WHEN updated_at >= ${startTime} AND created_at < ${startTime} THEN 1 END) as edited_notes,
      COUNT(*) as total_notes
    FROM notes
    WHERE deleted_at IS NULL
  `);
  const stats = statsRows[0] ?? null;

  const newRatio = (stats?.new_notes ?? 0) / Math.max(stats?.total_notes ?? 1, 1);
  const editRatio = (stats?.edited_notes ?? 0) / Math.max(stats?.total_notes ?? 1, 1);

  let currentPhase: ThinkingPhase;

  if (newRatio > 0.15) {
    currentPhase = "exploration";
  } else if (editRatio > 0.1 && newRatio < 0.05) {
    currentPhase = "reflection";
  } else if (newRatio > 0.05) {
    currentPhase = "structuring";
  } else {
    currentPhase = "implementation";
  }

  // 前週のフェーズと比較（簡易実装）
  return {
    current: currentPhase,
    transition: null, // TODO: 前週との比較
  };
}

/**
 * 偏りを検出
 */
async function detectBias(
  snapshotId: number | null
): Promise<{ category: string; percentage: number; message: string } | null> {
  if (!snapshotId) return null;

  // クラスタサイズの分布を確認
  const clusters = await db.all<{
    size: number;
    identity_id: number | null;
  }>(sql`
    SELECT size, identity_id
    FROM snapshot_clusters
    WHERE snapshot_id = ${snapshotId}
  `);

  if (clusters.length === 0) return null;

  const totalSize = clusters.reduce((sum, c) => sum + c.size, 0);
  if (totalSize === 0) return null;

  // 最大のクラスタを見つける
  const maxCluster = clusters.reduce(
    (max, c) => (c.size > max.size ? c : max),
    clusters[0]
  );

  const percentage = (maxCluster.size / totalSize) * 100;

  // 50%以上なら偏りアラート
  if (percentage >= 50) {
    const label = maxCluster.identity_id
      ? await getIdentityLabel(maxCluster.identity_id)
      : "特定のクラスタ";

    return {
      category: label ?? "特定のクラスタ",
      percentage: Math.round(percentage),
      message: `「${label ?? "特定のクラスタ"}」に思考が集中しています（${Math.round(percentage)}%）`,
    };
  }

  return null;
}

/**
 * アイデンティティのラベルを取得
 */
async function getIdentityLabel(identityId: number): Promise<string | null> {
  const rows = await db.all<{ label: string | null }>(
    sql`SELECT label FROM cluster_identities WHERE id = ${identityId}`
  );
  return rows[0]?.label ?? null;
}

/**
 * 空白領域を検出
 */
async function detectBlindSpots(
  now: number
): Promise<Array<{ identityLabel: string; daysSinceLastUpdate: number }>> {
  // 2週間以上更新がないクラスタ
  const twoWeeksAgo = now - 14 * 24 * 60 * 60;

  const blindSpots = await db.all<{
    id: number;
    label: string | null;
    last_seen_snapshot_id: number | null;
  }>(sql`
    SELECT ci.id, ci.label, ci.last_seen_snapshot_id
    FROM cluster_identities ci
    WHERE ci.is_active = 1
  `);

  const results: Array<{ identityLabel: string; daysSinceLastUpdate: number }> = [];

  for (const spot of blindSpots) {
    if (!spot.last_seen_snapshot_id) continue;

    const snapshotRows = await db.all<{ created_at: number }>(
      sql`SELECT created_at FROM clustering_snapshots WHERE id = ${spot.last_seen_snapshot_id}`
    );
    const snapshot = snapshotRows[0] ?? null;

    if (snapshot && snapshot.created_at < twoWeeksAgo) {
      const daysSince = Math.floor((now - snapshot.created_at) / (24 * 60 * 60));
      results.push({
        identityLabel: spot.label ?? `クラスタ${spot.id}`,
        daysSinceLastUpdate: daysSince,
      });
    }
  }

  return results.sort((a, b) => b.daysSinceLastUpdate - a.daysSinceLastUpdate);
}

/**
 * 新しく生まれた思考を取得
 */
async function getNewThoughts(
  startTime: number,
  endTime: number
): Promise<Array<{ identityId: number; label: string | null; size: number; sampleTitle: string | null }>> {
  const rows = await db.all<{
    identity_id: number;
    label: string | null;
    size: number;
    sample_note_id: string | null;
  }>(sql`
    SELECT DISTINCT sc.identity_id, ci.label, sc.size, sc.sample_note_id
    FROM cluster_events ce
    JOIN clustering_snapshots cs ON ce.snapshot_id = cs.id
    JOIN snapshot_clusters sc ON cs.id = sc.snapshot_id
    LEFT JOIN cluster_identities ci ON sc.identity_id = ci.id
    WHERE ce.event_type = 'emerge'
    AND cs.created_at >= ${startTime}
    AND cs.created_at <= ${endTime}
    AND sc.identity_id IS NOT NULL
  `);

  const results: Array<{ identityId: number; label: string | null; size: number; sampleTitle: string | null }> = [];

  for (const r of rows) {
    let sampleTitle: string | null = null;

    if (r.sample_note_id) {
      const noteRows = await db.all<{ title: string | null }>(
        sql`SELECT title FROM notes WHERE id = ${r.sample_note_id}`
      );
      sampleTitle = noteRows[0]?.title ?? null;
    }

    results.push({
      identityId: r.identity_id,
      label: r.label,
      size: r.size,
      sampleTitle,
    });
  }

  return results;
}

/**
 * 収束した思考を取得
 */
async function getExtinctThoughts(
  startTime: number,
  endTime: number
): Promise<Array<{ label: string | null; absorbedBy: string | null; size: number; sampleTitle: string | null }>> {
  // イベント詳細からidentity_idを取得し、ラベルを解決
  const rows = await db.all<{
    details: string;
  }>(sql`
    SELECT ce.details
    FROM cluster_events ce
    JOIN clustering_snapshots cs ON ce.snapshot_id = cs.id
    WHERE ce.event_type = 'extinct'
    AND cs.created_at >= ${startTime}
    AND cs.created_at <= ${endTime}
  `);

  const results: Array<{ label: string | null; absorbedBy: string | null; size: number; sampleTitle: string | null }> = [];

  for (const r of rows) {
    try {
      const details = JSON.parse(r.details);
      // details.clusterId は snapshot_clusters.id なので、identity_id を取得
      const clusterId = details.clusterId;
      const lastSize = details.lastSize ?? 0;
      let label: string | null = null;
      let sampleTitle: string | null = null;

      if (clusterId) {
        // snapshot_clusters からidentity_id と sample_note_id を取得
        const clusterRows = await db.all<{ identity_id: number | null; sample_note_id: string | null }>(
          sql`SELECT identity_id, sample_note_id FROM snapshot_clusters WHERE id = ${clusterId}`
        );
        const identityId = clusterRows[0]?.identity_id;
        const sampleNoteId = clusterRows[0]?.sample_note_id;

        if (identityId) {
          // cluster_identities からラベルを取得
          const labelRows = await db.all<{ label: string | null }>(
            sql`SELECT label FROM cluster_identities WHERE id = ${identityId}`
          );
          label = labelRows[0]?.label ?? null;
        }

        if (sampleNoteId) {
          const noteRows = await db.all<{ title: string | null }>(
            sql`SELECT title FROM notes WHERE id = ${sampleNoteId}`
          );
          sampleTitle = noteRows[0]?.title ?? null;
        }
      }

      results.push({
        label: label ?? `クラスタ${clusterId ?? '不明'}`,
        absorbedBy: null,
        size: lastSize,
        sampleTitle,
      });
    } catch {
      results.push({
        label: null,
        absorbedBy: null,
        size: 0,
        sampleTitle: null,
      });
    }
  }

  return results;
}

/**
 * イベントをサマリー化
 */
function summarizeEvents(
  events: Array<{ event_type: string; details: string }>
): EventSummary[] {
  const eventMap = new Map<string, EventSummary>();

  for (const event of events) {
    const type = event.event_type as EventSummary["type"];
    if (!eventMap.has(type)) {
      eventMap.set(type, { type, count: 0, details: [] });
    }

    const summary = eventMap.get(type)!;
    summary.count++;

    try {
      const details = JSON.parse(event.details);
      summary.details.push(details);
    } catch {
      // ignore parse errors
    }
  }

  return Array.from(eventMap.values());
}

/**
 * 視点分布を取得（フェーズ2）
 */
async function getPerspectiveDistribution(
  startTime: number,
  endTime: number
): Promise<Record<Perspective, number> | null> {
  // perspective カラムが存在するか確認
  const hasColumnRows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM pragma_table_info('notes')
    WHERE name = 'perspective'
  `);
  const hasColumn = hasColumnRows[0] ?? null;

  if (!hasColumn || hasColumn.count === 0) {
    // カラムがない場合はnullを返す
    return null;
  }

  const rows = await db.all<{
    perspective: string | null;
    count: number;
  }>(sql`
    SELECT perspective, COUNT(*) as count
    FROM notes
    WHERE deleted_at IS NULL
    AND (created_at >= ${startTime} OR updated_at >= ${startTime})
    GROUP BY perspective
  `);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return null;

  const distribution: Record<Perspective, number> = {
    engineer: 0,
    po: 0,
    user: 0,
    cto: 0,
    team: 0,
    stakeholder: 0,
  };

  for (const row of rows) {
    if (row.perspective && PERSPECTIVES.includes(row.perspective as Perspective)) {
      distribution[row.perspective as Perspective] = Math.round((row.count / total) * 100);
    }
  }

  return distribution;
}
