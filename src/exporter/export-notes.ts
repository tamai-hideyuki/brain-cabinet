#!/usr/bin/env tsx
/**
 * DB → Markdown エクスポーター
 *
 * 使用方法:
 *   pnpm export-notes              # 全件エクスポート
 *   pnpm export-notes <note-id>    # 単一ノートをエクスポート
 *   pnpm export-notes --dry-run    # ドライラン（実際には書き込まない）
 */

import fs from "fs";
import path from "path";
import { db } from "../shared/db/client";
import { notes } from "../shared/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "../shared/utils/slugify";
import { formatNoteAsMarkdown, generateExportPath } from "./markdown-formatter";

// エクスポート先ディレクトリ
const EXPORT_DIR = "./notes";

interface ExportOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

interface ExportResult {
  success: boolean;
  noteId: string;
  title: string;
  exportPath: string;
  error?: string;
}

/**
 * ディレクトリが存在しなければ作成
 */
const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * 単一ノートをエクスポート
 */
const exportSingleNote = async (
  noteId: string,
  options: ExportOptions = {}
): Promise<ExportResult> => {
  const { dryRun = false, verbose = false } = options;

  // ノートを取得
  const result = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  if (result.length === 0) {
    return {
      success: false,
      noteId,
      title: "",
      exportPath: "",
      error: "Note not found",
    };
  }

  const note = result[0];
  const relativePath = generateExportPath(note, slugify);
  const fullPath = path.join(EXPORT_DIR, relativePath);
  const dirPath = path.dirname(fullPath);

  // Markdown生成
  const markdown = formatNoteAsMarkdown(note);

  if (dryRun) {
    if (verbose) {
      console.log(`[DRY-RUN] Would write: ${fullPath}`);
      console.log("---");
      console.log(markdown.slice(0, 500) + (markdown.length > 500 ? "..." : ""));
      console.log("---");
    }
    return {
      success: true,
      noteId: note.id,
      title: note.title,
      exportPath: fullPath,
    };
  }

  try {
    // ディレクトリ作成
    ensureDir(dirPath);

    // ファイル書き込み
    fs.writeFileSync(fullPath, markdown, "utf-8");

    if (verbose) {
      console.log(`✔ Exported: ${note.title} → ${fullPath}`);
    }

    return {
      success: true,
      noteId: note.id,
      title: note.title,
      exportPath: fullPath,
    };
  } catch (err) {
    return {
      success: false,
      noteId: note.id,
      title: note.title,
      exportPath: fullPath,
      error: (err as Error).message,
    };
  }
};

/**
 * 全ノートをエクスポート
 */
const exportAllNotes = async (
  options: ExportOptions = {}
): Promise<ExportResult[]> => {
  const { dryRun = false, verbose = false } = options;

  const allNotes = await db.select().from(notes);
  console.log(`Found ${allNotes.length} notes to export.`);

  if (dryRun) {
    console.log("[DRY-RUN MODE] No files will be written.\n");
  }

  const results: ExportResult[] = [];

  for (const note of allNotes) {
    const result = await exportSingleNote(note.id, { dryRun, verbose });
    results.push(result);
  }

  return results;
};

/**
 * エクスポート結果のサマリーを表示
 */
const printSummary = (results: ExportResult[]): void => {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log("\n========== Export Summary ==========");
  console.log(`Total:     ${results.length}`);
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed:    ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed exports:");
    failed.forEach((r) => {
      console.log(`  ✗ ${r.title || r.noteId}: ${r.error}`);
    });
  }

  console.log("====================================\n");
};

/**
 * メイン処理
 */
const main = async () => {
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose") || args.includes("-v");

  // --dry-run, --verbose, -v を除いたIDを取得
  const noteId = args.find((arg) => !arg.startsWith("-"));

  console.log("🗂  Brain Cabinet: DB → Markdown Exporter\n");

  if (noteId) {
    // 単一ノートをエクスポート
    console.log(`Exporting single note: ${noteId}`);
    const result = await exportSingleNote(noteId, { dryRun, verbose: true });

    if (result.success) {
      console.log(`\n✔ Export completed: ${result.exportPath}`);
    } else {
      console.error(`\n✗ Export failed: ${result.error}`);
      process.exit(1);
    }
  } else {
    // 全件エクスポート
    const results = await exportAllNotes({ dryRun, verbose });
    printSummary(results);

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      process.exit(1);
    }
  }
};

main().catch((err) => {
  console.error("Export error:", err);
  process.exit(1);
});
