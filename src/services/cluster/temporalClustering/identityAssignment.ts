/**
 * Identity Assignment
 *
 * クラスタアイデンティティの付与ロジック
 *
 * 付与ルール:
 * - predecessor がある → predecessorのidentityを継承
 * - split → 同じidentityを共有（初期実装）
 * - emerge → 新identityを作成
 * - extinct → identityをis_active=0に設定
 */

import { db } from "../../../db/client";
import { sql, type SQL } from "drizzle-orm";
import { logger } from "../../../utils/logger";
import type { SnapshotClusterInfo, ClusterIdentity, LineageCandidate } from "./types";

// トランザクションコンテキストの型（run メソッドを持つもの）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxContext = {
  run: (query: SQL) => Promise<{ lastInsertRowid?: number | bigint }>;
};

/**
 * 新しいクラスタアイデンティティを作成
 */
async function createIdentityWithTx(
  tx: TxContext,
  snapshotId: number,
  label?: string,
  description?: string
): Promise<number> {
  const result = await tx.run(sql`
    INSERT INTO cluster_identities (created_at, label, description, is_active, last_seen_snapshot_id)
    VALUES (${Math.floor(Date.now() / 1000)}, ${label ?? null}, ${description ?? null}, 1, ${snapshotId})
  `);
  return Number(result.lastInsertRowid);
}

/**
 * クラスタにidentityを割り当て
 */
async function assignIdentityToClusterWithTx(
  tx: TxContext,
  clusterId: number,
  identityId: number
): Promise<void> {
  await tx.run(sql`
    UPDATE snapshot_clusters SET identity_id = ${identityId} WHERE id = ${clusterId}
  `);
}

/**
 * identityのlast_seen_snapshot_idを更新
 */
async function updateIdentityLastSeenWithTx(
  tx: TxContext,
  identityId: number,
  snapshotId: number
): Promise<void> {
  await tx.run(sql`
    UPDATE cluster_identities
    SET last_seen_snapshot_id = ${snapshotId}, is_active = 1
    WHERE id = ${identityId}
  `);
}

/**
 * identityを非アクティブにする（消滅）
 */
async function deactivateIdentityWithTx(tx: TxContext, identityId: number): Promise<void> {
  await tx.run(sql`
    UPDATE cluster_identities SET is_active = 0 WHERE id = ${identityId}
  `);
}

/**
 * 全クラスタにidentityを割り当てる
 *
 * @param tx トランザクションコンテキスト
 * @param snapshotId 新スナップショットID
 * @param clusters 新スナップショットのクラスタ群
 * @param lineages クラスタID -> predecessor判定結果
 * @param previousClusters 前スナップショットのクラスタ群（identity継承用）
 */
export async function assignIdentities(
  tx: TxContext,
  snapshotId: number,
  clusters: SnapshotClusterInfo[],
  lineages: Map<number, LineageCandidate>,
  previousClusters: SnapshotClusterInfo[]
): Promise<void> {
  // 前スナップショットのクラスタID -> identityIdのマップ
  const prevClusterToIdentity = new Map<number, number>();
  for (const prev of previousClusters) {
    if (prev.identityId !== null) {
      prevClusterToIdentity.set(prev.id, prev.identityId);
    }
  }

  // 今回参照されたidentityを記録（消滅判定用）
  const seenIdentities = new Set<number>();

  for (const cluster of clusters) {
    const lineage = lineages.get(cluster.id);

    if (!lineage || lineage.predecessorClusterId === null) {
      // emerge: 新identityを作成
      const newIdentityId = await createIdentityWithTx(tx, snapshotId);
      await assignIdentityToClusterWithTx(tx, cluster.id, newIdentityId);
      seenIdentities.add(newIdentityId);
      logger.debug(
        { clusterId: cluster.id, identityId: newIdentityId },
        "[IdentityAssignment] Created new identity for emerged cluster"
      );
    } else {
      // predecessorがある → identityを継承
      const predecessorIdentityId = prevClusterToIdentity.get(lineage.predecessorClusterId);

      if (predecessorIdentityId !== undefined) {
        // 既存identityを継承
        await assignIdentityToClusterWithTx(tx, cluster.id, predecessorIdentityId);
        await updateIdentityLastSeenWithTx(tx, predecessorIdentityId, snapshotId);
        seenIdentities.add(predecessorIdentityId);
        logger.debug(
          { clusterId: cluster.id, identityId: predecessorIdentityId, from: lineage.predecessorClusterId },
          "[IdentityAssignment] Inherited identity from predecessor"
        );
      } else {
        // predecessorにidentityがない（初期状態など）→ 新規作成
        const newIdentityId = await createIdentityWithTx(tx, snapshotId);
        await assignIdentityToClusterWithTx(tx, cluster.id, newIdentityId);
        seenIdentities.add(newIdentityId);
        logger.debug(
          { clusterId: cluster.id, identityId: newIdentityId },
          "[IdentityAssignment] Created new identity (predecessor had none)"
        );
      }
    }
  }

  // 消滅判定: 前スナップショットにあったidentityで今回見られなかったものを非アクティブに
  for (const prev of previousClusters) {
    if (prev.identityId !== null && !seenIdentities.has(prev.identityId)) {
      await deactivateIdentityWithTx(tx, prev.identityId);
      logger.debug(
        { identityId: prev.identityId },
        "[IdentityAssignment] Deactivated extinct identity"
      );
    }
  }
}

/**
 * identityの一覧を取得
 */
export async function listIdentities(
  activeOnly: boolean = true
): Promise<ClusterIdentity[]> {
  const query = activeOnly
    ? sql`SELECT * FROM cluster_identities WHERE is_active = 1 ORDER BY created_at DESC`
    : sql`SELECT * FROM cluster_identities ORDER BY created_at DESC`;

  const rows = await db.all<{
    id: number;
    created_at: number;
    label: string | null;
    description: string | null;
    is_active: number;
    last_seen_snapshot_id: number | null;
  }>(query);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    label: row.label,
    description: row.description,
    isActive: row.is_active === 1,
    lastSeenSnapshotId: row.last_seen_snapshot_id,
  }));
}

/**
 * identityにラベルを設定
 */
export async function setIdentityLabel(
  identityId: number,
  label: string,
  description?: string
): Promise<void> {
  if (description !== undefined) {
    await db.run(sql`
      UPDATE cluster_identities
      SET label = ${label}, description = ${description}
      WHERE id = ${identityId}
    `);
  } else {
    await db.run(sql`
      UPDATE cluster_identities SET label = ${label} WHERE id = ${identityId}
    `);
  }
}

/**
 * 特定identityの全タイムラインを取得
 */
export async function getIdentityTimeline(
  identityId: number
): Promise<Array<{
  snapshotId: number;
  snapshotCreatedAt: number;
  clusterId: number;
  localId: number;
  size: number;
  cohesion: number | null;
}>> {
  const rows = await db.all<{
    snapshot_id: number;
    created_at: number;
    cluster_id: number;
    local_id: number;
    size: number;
    cohesion: number | null;
  }>(sql`
    SELECT
      sc.snapshot_id,
      cs.created_at,
      sc.id as cluster_id,
      sc.local_id,
      sc.size,
      sc.cohesion
    FROM snapshot_clusters sc
    JOIN clustering_snapshots cs ON sc.snapshot_id = cs.id
    WHERE sc.identity_id = ${identityId}
    ORDER BY cs.created_at ASC
  `);

  return rows.map((row) => ({
    snapshotId: row.snapshot_id,
    snapshotCreatedAt: row.created_at,
    clusterId: row.cluster_id,
    localId: row.local_id,
    size: row.size,
    cohesion: row.cohesion,
  }));
}
