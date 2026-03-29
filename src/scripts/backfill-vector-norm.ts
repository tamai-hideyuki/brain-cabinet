/**
 * vector_norm バックフィルスクリプト
 *
 * 既存の note_embeddings テーブルに vector_norm を埋める。
 * updated_at は更新しない（意味的更新ではないため）。
 */

import { db } from "../shared/db/client";
import { sql } from "drizzle-orm";

/**
 * L2ノルムを計算
 */
function calcNorm(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

/**
 * BufferをFloat32配列に変換
 */
function bufferToFloat32Array(
  buffer: Buffer | ArrayBuffer | Uint8Array
): number[] {
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

  const arrayBuffer = uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength
  );
  const float32 = new Float32Array(arrayBuffer);
  return Array.from(float32);
}

async function main() {
  console.log("🚀 vector_norm backfill starting...");

  // 全 embedding を取得
  const rows = await db.all<{
    note_id: string;
    embedding: Buffer;
    vector_norm: number | null;
  }>(sql`
    SELECT note_id, embedding, vector_norm FROM note_embeddings
  `);

  console.log(`📊 Total embeddings: ${rows.length}`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    // すでに vector_norm が入っていればスキップ
    if (row.vector_norm !== null) {
      skipped++;
      continue;
    }

    const vec = bufferToFloat32Array(row.embedding);
    if (vec.length === 0) {
      console.warn(`⚠️  Empty embedding for note_id: ${row.note_id}`);
      continue;
    }

    const norm = calcNorm(vec);

    // updated_at を変更せずに vector_norm のみ更新
    await db.run(sql`
      UPDATE note_embeddings
      SET vector_norm = ${norm}
      WHERE note_id = ${row.note_id}
    `);

    updated++;
  }

  console.log(`✅ Backfill completed!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already had value): ${skipped}`);

  // 検証：norm の範囲チェック
  const stats = await db.all<{
    min_norm: number;
    max_norm: number;
    avg_norm: number;
  }>(sql`
    SELECT
      MIN(vector_norm) as min_norm,
      MAX(vector_norm) as max_norm,
      AVG(vector_norm) as avg_norm
    FROM note_embeddings
    WHERE vector_norm IS NOT NULL
  `);

  if (stats.length > 0) {
    const { min_norm, max_norm, avg_norm } = stats[0];
    console.log(`\n📈 Norm statistics:`);
    console.log(`   Min: ${min_norm?.toFixed(4)}`);
    console.log(`   Max: ${max_norm?.toFixed(4)}`);
    console.log(`   Avg: ${avg_norm?.toFixed(4)}`);

    // MiniLM の正規化済み embedding は通常 0.99〜1.01 付近
    if (min_norm < 0.5 || max_norm > 2.0) {
      console.warn(
        `⚠️  Norm values outside expected range (0.5-2.0). Check embedding format.`
      );
    } else {
      console.log(`   ✅ Norm values are within expected range.`);
    }
  }
}

main().catch(console.error);
