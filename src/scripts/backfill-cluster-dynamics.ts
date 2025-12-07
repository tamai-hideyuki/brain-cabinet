/**
 * Cluster Dynamics バックフィルスクリプト
 *
 * 現在のクラスタ状態を cluster_dynamics テーブルに保存
 * - centroid: クラスタ内ノートの埋め込み平均
 * - cohesion: クラスタ内の凝集度（平均コサイン類似度）
 * - interactions: 他クラスタとの距離（JSON）
 */

import { db } from "../db/client";
import { sql } from "drizzle-orm";

/**
 * Buffer を Float32Array に変換
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
 * Float32Array を Buffer に変換
 */
function float32ArrayToBuffer(arr: number[]): Buffer {
  const float32 = new Float32Array(arr);
  return Buffer.from(float32.buffer);
}

/**
 * コサイン類似度を計算（L2 正規化済みなので dot product）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * ベクトルの平均を計算
 */
function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

/**
 * ベクトルを L2 正規化
 */
function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

async function main() {
  console.log("🚀 Cluster Dynamics バックフィル開始...\n");

  const today = new Date().toISOString().split("T")[0];
  console.log(`📅 日付: ${today}\n`);

  // 既存のデータを確認
  const existing = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM cluster_dynamics WHERE date = ${today}
  `);

  if (existing[0]?.count > 0) {
    console.log(`⚠️  ${today} のデータが既に存在します。削除して再作成します...`);
    await db.run(sql`DELETE FROM cluster_dynamics WHERE date = ${today}`);
  }

  // クラスタ一覧を取得
  const clusters = await db.all<{ id: number }>(sql`
    SELECT DISTINCT id FROM clusters ORDER BY id
  `);

  console.log(`📊 クラスタ数: ${clusters.length}\n`);

  // 全ノートの埋め込みとクラスタ情報を取得
  const embeddings = await db.all<{
    note_id: string;
    embedding: Buffer;
    cluster_id: number | null;
  }>(sql`
    SELECT ne.note_id, ne.embedding, n.cluster_id
    FROM note_embeddings ne
    JOIN notes n ON ne.note_id = n.id
  `);

  console.log(`🧠 総埋め込み数: ${embeddings.length}\n`);

  // クラスタごとに埋め込みをグループ化
  const clusterEmbeddings = new Map<number, number[][]>();
  for (const e of embeddings) {
    if (e.cluster_id === null) continue;
    const vec = bufferToFloat32Array(e.embedding);
    if (vec.length === 0) continue;

    const list = clusterEmbeddings.get(e.cluster_id) ?? [];
    list.push(vec);
    clusterEmbeddings.set(e.cluster_id, list);
  }

  // 各クラスタの centroid を計算
  const clusterCentroids = new Map<number, number[]>();
  for (const [clusterId, vectors] of clusterEmbeddings) {
    const centroid = normalizeVector(meanVector(vectors));
    clusterCentroids.set(clusterId, centroid);
  }

  // 各クラスタの動態を計算・保存
  const results: Array<{
    clusterId: number;
    noteCount: number;
    cohesion: number;
    interactions: Record<string, number>;
  }> = [];

  for (const { id: clusterId } of clusters) {
    const vectors = clusterEmbeddings.get(clusterId) ?? [];
    const centroid = clusterCentroids.get(clusterId);

    if (!centroid || vectors.length === 0) {
      console.log(`   クラスタ ${clusterId}: ノートなし、スキップ`);
      continue;
    }

    // 凝集度を計算（各ノートと centroid のコサイン類似度の平均）
    let cohesionSum = 0;
    for (const vec of vectors) {
      cohesionSum += cosineSimilarity(vec, centroid);
    }
    const cohesion = round4(cohesionSum / vectors.length);

    // 他クラスタとの距離を計算
    const interactions: Record<string, number> = {};
    for (const [otherId, otherCentroid] of clusterCentroids) {
      if (otherId === clusterId) continue;
      const sim = cosineSimilarity(centroid, otherCentroid);
      interactions[String(otherId)] = round4(sim);
    }

    // データベースに保存
    const centroidBuffer = float32ArrayToBuffer(centroid);
    const interactionsJson = JSON.stringify(interactions);

    await db.run(sql`
      INSERT INTO cluster_dynamics
        (date, cluster_id, centroid, cohesion, note_count, interactions, created_at)
      VALUES
        (${today}, ${clusterId}, ${centroidBuffer}, ${cohesion}, ${vectors.length}, ${interactionsJson}, datetime('now'))
    `);

    results.push({
      clusterId,
      noteCount: vectors.length,
      cohesion,
      interactions,
    });

    console.log(`   クラスタ ${clusterId}: ${vectors.length} ノート, 凝集度 ${cohesion.toFixed(4)}`);
  }

  console.log(`\n✅ Cluster Dynamics バックフィル完了!`);
  console.log(`   保存されたクラスタ: ${results.length} 件`);

  // サマリーを表示
  console.log(`\n📊 クラスタ間距離マトリクス:`);
  const clusterIds = results.map((r) => r.clusterId).sort((a, b) => a - b);
  console.log(`     ${clusterIds.map((id) => id.toString().padStart(6)).join("")}`);

  for (const r of results.sort((a, b) => a.clusterId - b.clusterId)) {
    const row = clusterIds.map((otherId) => {
      if (otherId === r.clusterId) return " 1.00 ";
      return (r.interactions[String(otherId)]?.toFixed(2) ?? " N/A ").padStart(6);
    });
    console.log(`  ${r.clusterId}: ${row.join("")}`);
  }

  // 最も凝集度の高いクラスタ
  const sortedByCohesion = [...results].sort((a, b) => b.cohesion - a.cohesion);
  console.log(`\n🎯 凝集度ランキング:`);
  for (const r of sortedByCohesion.slice(0, 3)) {
    console.log(`   クラスタ ${r.clusterId}: ${r.cohesion.toFixed(4)} (${r.noteCount} ノート)`);
  }
}

main().catch(console.error);
