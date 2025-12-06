/**
 * Embedding一括生成スクリプト（MiniLM版）
 *
 * 既存のnotesテーブルの全ノートに対してEmbeddingを生成・保存する
 * ローカルのMiniLMモデルを使用するため、APIキー不要
 *
 * 使い方:
 *   pnpm run init-embeddings
 *
 * オプション:
 *   --force: 既存のEmbeddingも再生成する
 */

import { generateAllEmbeddings } from "../services/embeddingService";
import { countEmbeddings, createEmbeddingTable, checkEmbeddingTableExists } from "../repositories/embeddingRepo";
import { db } from "../db/client";
import { sql } from "drizzle-orm";

const main = async () => {
  const forceRegenerate = process.argv.includes("--force");

  console.log("🧠 Embedding一括生成を開始します...");
  console.log("   モデル: MiniLM-L6-v2 (ローカル)");
  console.log("   次元数: 384");
  if (forceRegenerate) {
    console.log("   モード: 強制再生成（--force）\n");
  } else {
    console.log("   モード: 新規のみ\n");
  }

  // テーブル確認・作成
  const exists = await checkEmbeddingTableExists();
  if (exists) {
    const count = await countEmbeddings();
    console.log(`✓ note_embeddings テーブルは既に存在します（${count}件のEmbedding）`);

    if (forceRegenerate && count > 0) {
      console.log("→ 既存のEmbeddingを削除中...");
      await db.run(sql`DELETE FROM note_embeddings`);
      console.log("✓ 既存のEmbeddingを削除しました");
    }
  } else {
    console.log("→ note_embeddings テーブルを作成中...");
    await createEmbeddingTable();
    console.log("✓ note_embeddings テーブルを作成しました");
  }

  // embedding_version列が存在するか確認し、なければ追加
  try {
    await db.run(sql`
      ALTER TABLE note_embeddings ADD COLUMN embedding_version TEXT NOT NULL DEFAULT 'minilm-v1'
    `);
    console.log("✓ embedding_version 列を追加しました");
  } catch {
    // 列が既に存在する場合は無視
  }

  console.log("\n→ 全ノートのEmbeddingを生成中...");
  console.log("  （初回はモデルのダウンロードに時間がかかります）\n");

  const startTime = Date.now();

  const { success, failed, errors } = await generateAllEmbeddings((current, total, noteId) => {
    const percent = Math.round((current / total) * 100);
    process.stdout.write(`\r  [${percent}%] ${current}/${total} - ${noteId.slice(0, 8)}...`);
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n");
  console.log(`✓ 成功: ${success}件`);
  if (failed > 0) {
    console.log(`✗ 失敗: ${failed}件`);
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
  }

  console.log(`\n🎉 Embedding生成が完了しました！（${elapsed}秒）`);
  process.exit(0);
};

main().catch((err) => {
  console.error("\n❌ エラーが発生しました:", err);
  process.exit(1);
});
