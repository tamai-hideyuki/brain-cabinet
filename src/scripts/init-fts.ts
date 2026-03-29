/**
 * FTS5インデックス初期化スクリプト
 *
 * 既存のnotesテーブルのデータをFTS5テーブルに投入する
 *
 * 使い方:
 *   npx tsx src/scripts/init-fts.ts
 */

import { findAllNotes } from "../modules/note/repository";
import { createFTSTable, rebuildFTS, checkFTSTableExists } from "../modules/search/ftsRepository";

const main = async () => {
  console.log("🔍 FTS5インデックス初期化を開始します...\n");

  // 1. FTS5テーブルの存在確認・作成
  const exists = await checkFTSTableExists();
  if (exists) {
    console.log("✓ notes_fts テーブルは既に存在します");
  } else {
    console.log("→ notes_fts テーブルを作成中...");
    await createFTSTable();
    console.log("✓ notes_fts テーブルを作成しました");
  }

  // 2. 全ノートを取得
  console.log("\n→ 全ノートを取得中...");
  const allNotes = await findAllNotes();
  console.log(`✓ ${allNotes.length} 件のノートを取得しました`);

  // 3. FTSテーブルを再構築
  console.log("\n→ FTS5インデックスを構築中...");
  await rebuildFTS(allNotes);
  console.log(`✓ ${allNotes.length} 件のノートをインデックス化しました`);

  console.log("\n🎉 FTS5インデックス初期化が完了しました！");
  process.exit(0);
};

main().catch((err) => {
  console.error("❌ エラーが発生しました:", err);
  process.exit(1);
});
