#!/usr/bin/env tsx
/**
 * DB ↔ Markdown 整合性チェッカー
 *
 * 使用方法:
 *   pnpm integrity-check              # 全件チェック
 *   pnpm integrity-check --verbose    # 詳細表示
 *   pnpm integrity-check --json       # JSON形式で出力
 */

import fs from "fs";
import path from "path";
import { db } from "../db/client";
import { notes } from "../db/schema";
import { parseMarkdown, extractNoteData } from "../utils/markdown-parser";
import { formatNoteAsMarkdown } from "../exporter/markdown-formatter";

// チェック対象ディレクトリ
const NOTES_DIR = "./notes";

// ステータス定義
type IntegrityStatus =
  | "OK"           // 完全一致
  | "DIFF"         // 内容に差分あり
  | "DB_ONLY"      // DBにのみ存在
  | "MD_ONLY"      // Markdownのみに存在
  | "NO_ID";       // MarkdownにIDがない

interface CheckResult {
  status: IntegrityStatus;
  noteId: string;
  title: string;
  mdPath?: string;
  details?: string;
}

/**
 * notes/ ディレクトリから全.mdファイルを再帰的に収集
 */
const collectMarkdownFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...collectMarkdownFiles(fullPath));
    } else if (item.endsWith(".md")) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Markdownファイルを読み込んでパース
 */
const loadMarkdownFile = (filePath: string) => {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = parseMarkdown(content);
  const noteData = extractNoteData(parsed);
  return { ...noteData, filePath, rawContent: content };
};

/**
 * 本文の正規化（比較用）
 * - 先頭・末尾の空白除去
 * - 連続改行を単一改行に
 */
const normalizeContent = (content: string): string => {
  return content
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
};

/**
 * DBノートとMarkdownの内容を比較
 */
const compareNoteContent = (
  dbNote: typeof notes.$inferSelect,
  mdContent: string
): boolean => {
  // DBから再生成したMarkdownと比較
  const expectedMarkdown = formatNoteAsMarkdown(dbNote);
  const normalizedExpected = normalizeContent(expectedMarkdown);
  const normalizedActual = normalizeContent(mdContent);

  return normalizedExpected === normalizedActual;
};

/**
 * 整合性チェック実行
 */
const runIntegrityCheck = async (options: {
  verbose?: boolean;
}): Promise<CheckResult[]> => {
  const { verbose = false } = options;
  const results: CheckResult[] = [];

  // 1. DBから全ノートを取得
  const dbNotes = await db.select().from(notes);
  const dbNotesById = new Map(dbNotes.map((n) => [n.id, n]));

  if (verbose) {
    console.log(`📊 DB: ${dbNotes.length} notes found`);
  }

  // 2. Markdownファイルを収集
  const mdFiles = collectMarkdownFiles(NOTES_DIR);

  if (verbose) {
    console.log(`📄 Markdown: ${mdFiles.length} files found\n`);
  }

  // 3. Markdownファイルをパースしてマップ作成
  const mdNotesById = new Map<string, ReturnType<typeof loadMarkdownFile>>();
  const mdFilesWithoutId: string[] = [];

  for (const filePath of mdFiles) {
    try {
      const mdNote = loadMarkdownFile(filePath);

      if (!mdNote.id) {
        mdFilesWithoutId.push(filePath);
        results.push({
          status: "NO_ID",
          noteId: "",
          title: mdNote.title || path.basename(filePath, ".md"),
          mdPath: filePath,
          details: "Frontmatter に id がありません",
        });
        continue;
      }

      mdNotesById.set(mdNote.id, mdNote);
    } catch (err) {
      if (verbose) {
        console.error(`⚠️  Failed to parse: ${filePath}`, err);
      }
    }
  }

  // 4. DBノートを走査してチェック
  for (const dbNote of dbNotes) {
    const mdNote = mdNotesById.get(dbNote.id);

    if (!mdNote) {
      // DBにのみ存在
      results.push({
        status: "DB_ONLY",
        noteId: dbNote.id,
        title: dbNote.title,
        details: "Markdownファイルが見つかりません",
      });
      continue;
    }

    // 内容比較
    const isMatch = compareNoteContent(dbNote, mdNote.rawContent);

    if (isMatch) {
      results.push({
        status: "OK",
        noteId: dbNote.id,
        title: dbNote.title,
        mdPath: mdNote.filePath,
      });
    } else {
      results.push({
        status: "DIFF",
        noteId: dbNote.id,
        title: dbNote.title,
        mdPath: mdNote.filePath,
        details: "DBとMarkdownの内容が異なります",
      });
    }

    // チェック済みとしてマーク
    mdNotesById.delete(dbNote.id);
  }

  // 5. 残ったMarkdown（DBに存在しない）
  for (const [id, mdNote] of mdNotesById) {
    results.push({
      status: "MD_ONLY",
      noteId: id,
      title: mdNote.title || "Unknown",
      mdPath: mdNote.filePath,
      details: "DBにこのIDのノートが存在しません",
    });
  }

  return results;
};

/**
 * 結果を表示
 */
const printResults = (
  results: CheckResult[],
  options: { verbose?: boolean; json?: boolean }
) => {
  const { verbose = false, json = false } = options;

  if (json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // ステータスごとにカウント
  const counts = {
    OK: 0,
    DIFF: 0,
    DB_ONLY: 0,
    MD_ONLY: 0,
    NO_ID: 0,
  };

  // 結果を表示
  for (const result of results) {
    counts[result.status]++;

    const icon = {
      OK: "✅",
      DIFF: "⚠️ ",
      DB_ONLY: "📦",
      MD_ONLY: "📄",
      NO_ID: "❓",
    }[result.status];

    const statusLabel = {
      OK: "[OK]",
      DIFF: "[DIFF]",
      DB_ONLY: "[DB_ONLY]",
      MD_ONLY: "[MD_ONLY]",
      NO_ID: "[NO_ID]",
    }[result.status];

    // OKは verbose でのみ表示
    if (result.status === "OK" && !verbose) {
      continue;
    }

    console.log(`${icon} ${statusLabel} ${result.title}`);

    if (verbose && result.noteId) {
      console.log(`   ID: ${result.noteId}`);
    }
    if (verbose && result.mdPath) {
      console.log(`   Path: ${result.mdPath}`);
    }
    if (result.details) {
      console.log(`   → ${result.details}`);
    }
  }

  // サマリー
  console.log("\n========== Integrity Check Summary ==========");
  console.log(`✅ OK:       ${counts.OK}`);
  console.log(`⚠️  DIFF:     ${counts.DIFF}`);
  console.log(`📦 DB_ONLY:  ${counts.DB_ONLY}`);
  console.log(`📄 MD_ONLY:  ${counts.MD_ONLY}`);
  console.log(`❓ NO_ID:    ${counts.NO_ID}`);
  console.log(`─────────────────────────────────────────────`);
  console.log(`   Total:    ${results.length}`);
  console.log("=============================================\n");

  // 問題があればヒント表示
  if (counts.DIFF > 0) {
    console.log("💡 DIFF を解消するには:");
    console.log("   - pnpm export-notes  → DB → Markdown に同期");
    console.log("   - pnpm import-notes ./notes → Markdown → DB に同期\n");
  }

  if (counts.DB_ONLY > 0) {
    console.log("💡 DB_ONLY を解消するには:");
    console.log("   - pnpm export-notes  → Markdown を生成\n");
  }

  if (counts.MD_ONLY > 0) {
    console.log("💡 MD_ONLY を解消するには:");
    console.log("   - pnpm import-notes ./notes → DB に取り込む");
    console.log("   - または該当ファイルを削除\n");
  }
};

/**
 * メイン処理
 */
const main = async () => {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const json = args.includes("--json");

  console.log("🔍 Brain Cabinet: Integrity Check\n");

  const results = await runIntegrityCheck({ verbose });
  printResults(results, { verbose, json });

  // 問題があれば終了コード1
  const hasIssues = results.some((r) => r.status !== "OK");
  process.exit(hasIssues ? 1 : 0);
};

main().catch((err) => {
  console.error("Check error:", err);
  process.exit(1);
});
