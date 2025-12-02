/**
 * Embedding一括生成スクリプト
 *
 * 既存のnotesテーブルの全ノートに対してEmbeddingを生成・保存する
 *
 * 使い方:
 *   OPENAI_API_KEY=sk-xxx npx tsx src/scripts/init-embeddings.ts
 *
 * 環境変数:
 *   OPENAI_API_KEY: OpenAI APIキー（必須）
 */

import { generateAllEmbeddings } from "../services/embeddingService";
import { countEmbeddings, createEmbeddingTable, checkEmbeddingTableExists } from "../repositories/embeddingRepo";

const main = async () => {
  // APIキーチェック
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY が設定されていません");
    console.error("使い方: OPENAI_API_KEY=sk-xxx npx tsx src/scripts/init-embeddings.ts");
    process.exit(1);
  }

  console.log("🧠 Embedding一括生成を開始します...\n");

  // テーブル確認・作成
  const exists = await checkEmbeddingTableExists();
  if (exists) {
    const count = await countEmbeddings();
    console.log(`✓ note_embeddings テーブルは既に存在します（${count}件のEmbedding）`);
  } else {
    console.log("→ note_embeddings テーブルを作成中...");
    await createEmbeddingTable();
    console.log("✓ note_embeddings テーブルを作成しました");
  }

  console.log("\n→ 全ノートのEmbeddingを生成中...");
  console.log("  （OpenAI API を呼び出すため、少し時間がかかります）\n");

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
