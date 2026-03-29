/**
 * Concept Influence Graph バックフィルスクリプト（C モデル：Drift 連動）
 *
 * 式: influence(A → B) = cosine(A, B) × drift_score(B)
 *
 * 手順:
 * 1. semantic_diff > 0 のノート履歴を取得（ドリフトしたノート B）
 * 2. 各 B に対して、全ノート A との cosine 類似度を計算
 * 3. influence = cosine × drift_score >= 0.15 のペアをエッジとして保存
 */

import { db } from "../shared/db/client";
import { sql } from "drizzle-orm";
import { computeDriftScore } from "../modules/drift/computeDriftScore";

const INFLUENCE_THRESHOLD = 0.15; // 影響エッジを作成する最小重み

/**
 * Buffer を Float32Array に変換（embeddingRepo.ts から移植）
 */
function bufferToFloat32Array(buffer: Buffer | ArrayBuffer | Uint8Array): number[] {
  let uint8: Uint8Array;

  if (buffer instanceof ArrayBuffer) {
    uint8 = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    uint8 = buffer;
  } else if (Buffer.isBuffer(buffer)) {
    uint8 = new Uint8Array(buffer);
  } else {
    return [];
  }

  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
  const float32 = new Float32Array(arrayBuffer);
  return Array.from(float32);
}

/**
 * コサイン類似度を計算（MiniLM は L2 正規化済みなので dot product でOK）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

/**
 * 4桁で丸める
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

async function main() {
  console.log("🚀 Concept Influence バックフィル開始（C モデル：Drift 連動）...\n");

  // 既存のエッジをクリア
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM note_influence_edges
  `);

  if (existingCount[0]?.count > 0) {
    console.log(`⚠️  既存のエッジ ${existingCount[0].count} 件をクリアします...`);
    await db.run(sql`DELETE FROM note_influence_edges`);
  }

  // Step 1: ドリフトしたノート（B）を取得
  // note_history から semantic_diff > 0 のものを取得
  const driftedNotes = await db.all<{
    note_id: string;
    semantic_diff: number;
    prev_cluster_id: number | null;
    new_cluster_id: number | null;
  }>(sql`
    SELECT
      note_id,
      CAST(semantic_diff AS REAL) as semantic_diff,
      prev_cluster_id,
      new_cluster_id
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND CAST(semantic_diff AS REAL) > 0
    ORDER BY created_at DESC
  `);

  console.log(`📊 ドリフトしたノート履歴: ${driftedNotes.length} 件\n`);

  if (driftedNotes.length === 0) {
    console.log("⚠️  ドリフトしたノートがありません。終了します。");
    return;
  }

  // ユニークなノート ID を抽出（同じノートの複数回更新を集約）
  const noteIdToDrift = new Map<string, {
    maxSemanticDiff: number;
    clusterJumps: number;
    lastPrevCluster: number | null;
    lastNewCluster: number | null;
  }>();

  for (const h of driftedNotes) {
    const existing = noteIdToDrift.get(h.note_id);
    if (!existing) {
      noteIdToDrift.set(h.note_id, {
        maxSemanticDiff: h.semantic_diff,
        clusterJumps: (h.prev_cluster_id !== null && h.new_cluster_id !== null && h.prev_cluster_id !== h.new_cluster_id) ? 1 : 0,
        lastPrevCluster: h.prev_cluster_id,
        lastNewCluster: h.new_cluster_id,
      });
    } else {
      existing.maxSemanticDiff = Math.max(existing.maxSemanticDiff, h.semantic_diff);
      if (h.prev_cluster_id !== null && h.new_cluster_id !== null && h.prev_cluster_id !== h.new_cluster_id) {
        existing.clusterJumps++;
      }
    }
  }

  console.log(`📝 ユニークなドリフトノート: ${noteIdToDrift.size} 件\n`);

  // Step 2: 全ノートの embedding を取得
  const allEmbeddings = await db.all<{
    note_id: string;
    embedding: Buffer;
  }>(sql`
    SELECT note_id, embedding FROM note_embeddings
  `);

  console.log(`🧠 全埋め込みベクトル: ${allEmbeddings.length} 件\n`);

  // embedding をパース
  const embeddingMap = new Map<string, number[]>();
  for (const e of allEmbeddings) {
    const vec = bufferToFloat32Array(e.embedding);
    embeddingMap.set(e.note_id, vec);
  }

  // Step 3: 各ドリフトノート B に対して、全ノート A との影響度を計算
  let totalEdges = 0;
  let skippedSelf = 0;
  let skippedBelowThreshold = 0;
  let processedNotes = 0;

  const now = Math.floor(Date.now() / 1000);

  for (const [targetNoteId, driftInfo] of noteIdToDrift) {
    const targetVec = embeddingMap.get(targetNoteId);
    if (!targetVec) {
      continue;
    }

    // Drift Score を計算
    const { driftScore } = computeDriftScore({
      semanticDiff: driftInfo.maxSemanticDiff,
      oldClusterId: driftInfo.lastPrevCluster,
      newClusterId: driftInfo.lastNewCluster,
    });

    // 全ソースノートに対して影響度を計算
    for (const [sourceNoteId, sourceVec] of embeddingMap) {
      // 自己参照はスキップ
      if (sourceNoteId === targetNoteId) {
        skippedSelf++;
        continue;
      }

      // コサイン類似度を計算
      const cosineSim = cosineSimilarity(sourceVec, targetVec);

      // influence(A → B) = cosine(A, B) × drift_score(B)
      const weight = round4(cosineSim * driftScore);

      // しきい値以下はスキップ
      if (weight < INFLUENCE_THRESHOLD) {
        skippedBelowThreshold++;
        continue;
      }

      // エッジを挿入（既存があれば更新）
      await db.run(sql`
        INSERT INTO note_influence_edges
          (source_note_id, target_note_id, weight, cosine_sim, drift_score, created_at)
        VALUES
          (${sourceNoteId}, ${targetNoteId}, ${weight}, ${round4(cosineSim)}, ${round4(driftScore)}, ${now})
        ON CONFLICT(source_note_id, target_note_id) DO UPDATE SET
          weight = excluded.weight,
          cosine_sim = excluded.cosine_sim,
          drift_score = excluded.drift_score,
          created_at = excluded.created_at
      `);

      totalEdges++;
    }

    processedNotes++;
    if (processedNotes % 10 === 0) {
      console.log(`   処理中... ${processedNotes}/${noteIdToDrift.size} ノート`);
    }
  }

  console.log(`\n✅ Concept Influence Graph バックフィル完了!`);
  console.log(`   エッジ作成: ${totalEdges} 件`);
  console.log(`   スキップ（自己参照）: ${skippedSelf} 件`);
  console.log(`   スキップ（しきい値未満）: ${skippedBelowThreshold} 件`);

  // 統計を表示
  const stats = await db.all<{
    avg_weight: number;
    max_weight: number;
    min_weight: number;
  }>(sql`
    SELECT
      AVG(weight) as avg_weight,
      MAX(weight) as max_weight,
      MIN(weight) as min_weight
    FROM note_influence_edges
  `);

  if (stats[0]) {
    console.log(`\n📊 統計:`);
    console.log(`   平均 weight: ${stats[0].avg_weight?.toFixed(4) ?? "N/A"}`);
    console.log(`   最大 weight: ${stats[0].max_weight?.toFixed(4) ?? "N/A"}`);
    console.log(`   最小 weight: ${stats[0].min_weight?.toFixed(4) ?? "N/A"}`);
  }

  // 最も影響力の強いエッジを表示
  const topEdges = await db.all<{
    source_note_id: string;
    target_note_id: string;
    weight: number;
    cosine_sim: number;
    drift_score: number;
  }>(sql`
    SELECT source_note_id, target_note_id, weight, cosine_sim, drift_score
    FROM note_influence_edges
    ORDER BY weight DESC
    LIMIT 5
  `);

  if (topEdges.length > 0) {
    console.log(`\n🔗 最も影響力の強いエッジ（上位5件）:`);
    for (const edge of topEdges) {
      console.log(`   ${edge.source_note_id.slice(0, 8)}... → ${edge.target_note_id.slice(0, 8)}...`);
      console.log(`     weight: ${edge.weight.toFixed(4)} (cosine: ${edge.cosine_sim.toFixed(4)} × drift: ${edge.drift_score.toFixed(4)})`);
    }
  }

  // ノートごとの被影響度（in-degree）を表示
  const influencedNotes = await db.all<{
    target_note_id: string;
    edge_count: number;
    total_influence: number;
  }>(sql`
    SELECT
      target_note_id,
      COUNT(*) as edge_count,
      SUM(weight) as total_influence
    FROM note_influence_edges
    GROUP BY target_note_id
    ORDER BY total_influence DESC
    LIMIT 5
  `);

  if (influencedNotes.length > 0) {
    console.log(`\n🎯 最も影響を受けたノート（上位5件）:`);
    for (const note of influencedNotes) {
      console.log(`   ${note.target_note_id.slice(0, 8)}... : ${note.edge_count} edges, total influence: ${note.total_influence.toFixed(4)}`);
    }
  }
}

main().catch(console.error);
