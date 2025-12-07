/**
 * Concept Graph 初期化スクリプト
 *
 * クラスタ間のコサイン類似度を計算し、concept_graph_edges に保存。
 * weight: 類似度（0.0〜1.0）
 * mutual: 双方向性（現時点では weight と同じ値を設定）
 */

import { db } from "../db/client";
import { sql } from "drizzle-orm";

/**
 * Base64をFloat32Arrayに変換
 */
function base64ToFloat32Array(base64: string): number[] {
  const binary = Buffer.from(base64, "base64");
  const float32 = new Float32Array(
    binary.buffer,
    binary.byteOffset,
    binary.byteLength / 4
  );
  return Array.from(float32);
}

/**
 * コサイン類似度を計算
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

async function main() {
  console.log("🚀 Concept Graph initialization starting...");

  // 既存のエッジ数を確認
  const existingCount = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) as count FROM concept_graph_edges
  `);

  if (existingCount[0]?.count > 0) {
    console.log(
      `⚠️  concept_graph_edges already has ${existingCount[0].count} records.`
    );
    console.log(`   Clearing existing data for fresh initialization...`);
    await db.run(sql`DELETE FROM concept_graph_edges`);
  }

  // 全クラスタの centroid を取得
  const clusters = await db.all<{
    id: number;
    centroid: string;
  }>(sql`
    SELECT id, centroid FROM clusters WHERE centroid IS NOT NULL
  `);

  console.log(`📊 Clusters with centroid: ${clusters.length}`);

  if (clusters.length < 2) {
    console.log(`⚠️  Need at least 2 clusters to build graph.`);
    return;
  }

  // centroid を解析
  const clusterVectors = clusters.map((c) => ({
    id: c.id,
    vector: base64ToFloat32Array(c.centroid),
  }));

  // 全ペアの類似度を計算
  const now = Math.floor(Date.now() / 1000);
  let edgeCount = 0;

  console.log(`\n📈 Cluster similarity matrix:`);
  console.log(`     ${clusterVectors.map((c) => c.id.toString().padStart(4)).join(" ")}`);

  for (let i = 0; i < clusterVectors.length; i++) {
    const row: string[] = [];
    for (let j = 0; j < clusterVectors.length; j++) {
      if (i === j) {
        row.push("1.00");
        continue;
      }

      const similarity = cosineSimilarity(
        clusterVectors[i].vector,
        clusterVectors[j].vector
      );
      row.push(similarity.toFixed(2));

      // i < j の場合のみエッジを追加（重複防止）
      if (i < j) {
        await db.run(sql`
          INSERT INTO concept_graph_edges
            (source_cluster, target_cluster, weight, mutual, last_updated)
          VALUES
            (${clusterVectors[i].id}, ${clusterVectors[j].id}, ${similarity}, ${similarity}, ${now})
        `);
        edgeCount++;
      }
    }
    console.log(`  ${clusterVectors[i].id}: ${row.join(" ")}`);
  }

  console.log(`\n✅ Concept Graph initialized!`);
  console.log(`   Edges created: ${edgeCount}`);

  // 最も類似したペアと最も異なるペアを表示
  const mostSimilar = await db.all<{
    source_cluster: number;
    target_cluster: number;
    weight: number;
  }>(sql`
    SELECT source_cluster, target_cluster, weight
    FROM concept_graph_edges
    ORDER BY weight DESC
    LIMIT 3
  `);

  const leastSimilar = await db.all<{
    source_cluster: number;
    target_cluster: number;
    weight: number;
  }>(sql`
    SELECT source_cluster, target_cluster, weight
    FROM concept_graph_edges
    ORDER BY weight ASC
    LIMIT 3
  `);

  console.log(`\n🔗 Most similar clusters:`);
  for (const edge of mostSimilar) {
    console.log(
      `   Cluster ${edge.source_cluster} ↔ Cluster ${edge.target_cluster}: ${edge.weight.toFixed(4)}`
    );
  }

  console.log(`\n🔀 Most different clusters:`);
  for (const edge of leastSimilar) {
    console.log(
      `   Cluster ${edge.source_cluster} ↔ Cluster ${edge.target_cluster}: ${edge.weight.toFixed(4)}`
    );
  }
}

main().catch(console.error);
