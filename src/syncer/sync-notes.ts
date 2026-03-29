#!/usr/bin/env tsx
/**
 * Markdown → DB 同期ツール
 *
 * Frontmatter対応版の再インポーター
 * - IDありのファイル → DBを更新（IDベースでマッチング）
 * - IDなしのファイル → 新規作成 or パスベースで更新
 *
 * 使用方法:
 *   pnpm sync-notes              # ./notes を同期
 *   pnpm sync-notes <directory>  # 指定ディレクトリを同期
 *   pnpm sync-notes --dry-run    # ドライラン
 *   pnpm sync-notes --force      # 変更がなくても強制更新
 */

import fs from "fs";
import path from "path";
import { db } from "../shared/db/client";
import { notes, noteHistory } from "../shared/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { computeDiff } from "../shared/utils/diff";
import { extractMetadata } from "../shared/utils/metadata";
import { parseMarkdown, extractNoteData } from "../shared/utils/markdown-parser";

const SUPPORTED_EXT = [".md", ".txt", ".mdx"];
const DEFAULT_DIR = "./notes";

interface SyncOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

type SyncAction = "created" | "updated" | "skipped" | "failed";

interface SyncResult {
  action: SyncAction;
  filePath: string;
  title: string;
  noteId?: string;
  reason?: string;
}

/**
 * ディレクトリから全.mdファイルを再帰的に収集
 */
const collectFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const results: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (SUPPORTED_EXT.includes(path.extname(item))) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Markdownファイルを解析
 */
const parseMarkdownFile = (filePath: string) => {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const parsed = parseMarkdown(rawContent);
  const noteData = extractNoteData(parsed);

  return {
    ...noteData,
    body: parsed.body,
    rawContent,
    filePath,
  };
};

/**
 * 本文からコンテンツを抽出（H1タイトルを除去）
 */
const extractBodyContent = (body: string, title: string): string => {
  // 先頭のH1を除去
  const h1Pattern = new RegExp(`^#\\s+${escapeRegex(title)}\\s*\\n+`, "i");
  return body.replace(h1Pattern, "").trim();
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * 単一ファイルを同期
 */
const syncFile = async (
  filePath: string,
  options: SyncOptions
): Promise<SyncResult> => {
  const { dryRun = false, force = false, verbose = false } = options;

  try {
    const md = parseMarkdownFile(filePath);
    const fileTitle = md.title || path.basename(filePath, path.extname(filePath));

    // IDがある場合: IDベースでDBと照合
    if (md.id) {
      const existing = await db
        .select()
        .from(notes)
        .where(eq(notes.id, md.id))
        .limit(1);

      if (existing.length > 0) {
        const dbNote = existing[0];

        // 本文を抽出（Frontmatter除去済み、H1除去）
        const newContent = extractBodyContent(md.body, fileTitle) || md.body;

        // 変更チェック
        if (!force && dbNote.content.trim() === newContent.trim()) {
          return {
            action: "skipped",
            filePath,
            title: fileTitle,
            noteId: md.id,
            reason: "内容に変更なし",
          };
        }

        if (dryRun) {
          return {
            action: "updated",
            filePath,
            title: fileTitle,
            noteId: md.id,
            reason: "[DRY-RUN]",
          };
        }

        // 履歴保存
        const diff = computeDiff(dbNote.content, newContent);
        await db.insert(noteHistory).values({
          id: randomUUID(),
          noteId: md.id,
          content: dbNote.content,
          diff,
          createdAt: Math.floor(Date.now() / 1000),
        });

        // メタデータ再抽出（Markdownから or Frontmatterから）
        const metadata = extractMetadata(newContent, fileTitle);

        // DB更新
        await db
          .update(notes)
          .set({
            content: newContent,
            tags: JSON.stringify(md.tags.length > 0 ? md.tags : metadata.tags),
            category: md.category || metadata.category,
            headings: JSON.stringify(metadata.headings),
            updatedAt: Math.floor(Date.now() / 1000),
          })
          .where(eq(notes.id, md.id));

        return {
          action: "updated",
          filePath,
          title: fileTitle,
          noteId: md.id,
        };
      } else {
        // IDはあるがDBに存在しない → 新規作成（IDを維持）
        if (dryRun) {
          return {
            action: "created",
            filePath,
            title: fileTitle,
            noteId: md.id,
            reason: "[DRY-RUN] ID付きで新規作成",
          };
        }

        const newContent = extractBodyContent(md.body, fileTitle) || md.body;
        const metadata = extractMetadata(newContent, fileTitle);

        await db.insert(notes).values({
          id: md.id,
          title: fileTitle,
          path: filePath,
          content: newContent,
          tags: JSON.stringify(md.tags.length > 0 ? md.tags : metadata.tags),
          category: md.category || metadata.category,
          headings: JSON.stringify(metadata.headings),
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        });

        return {
          action: "created",
          filePath,
          title: fileTitle,
          noteId: md.id,
          reason: "ID付きで新規作成",
        };
      }
    }

    // IDがない場合: パスベースでDBと照合
    const existingByPath = await db
      .select()
      .from(notes)
      .where(eq(notes.path, filePath))
      .limit(1);

    const rawContent = md.rawContent;

    if (existingByPath.length > 0) {
      const dbNote = existingByPath[0];

      // 変更チェック
      if (!force && dbNote.content.trim() === rawContent.trim()) {
        return {
          action: "skipped",
          filePath,
          title: fileTitle,
          noteId: dbNote.id,
          reason: "内容に変更なし",
        };
      }

      if (dryRun) {
        return {
          action: "updated",
          filePath,
          title: fileTitle,
          noteId: dbNote.id,
          reason: "[DRY-RUN] パスベースで更新",
        };
      }

      // 履歴保存
      const diff = computeDiff(dbNote.content, rawContent);
      await db.insert(noteHistory).values({
        id: randomUUID(),
        noteId: dbNote.id,
        content: dbNote.content,
        diff,
        createdAt: Math.floor(Date.now() / 1000),
      });

      // メタデータ抽出
      const metadata = extractMetadata(rawContent, fileTitle);

      // DB更新
      await db
        .update(notes)
        .set({
          title: fileTitle,
          content: rawContent,
          tags: JSON.stringify(metadata.tags),
          category: metadata.category,
          headings: JSON.stringify(metadata.headings),
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(eq(notes.path, filePath));

      return {
        action: "updated",
        filePath,
        title: fileTitle,
        noteId: dbNote.id,
        reason: "パスベースで更新",
      };
    }

    // 新規作成
    if (dryRun) {
      return {
        action: "created",
        filePath,
        title: fileTitle,
        reason: "[DRY-RUN] 新規作成",
      };
    }

    const newId = randomUUID();
    const metadata = extractMetadata(rawContent, fileTitle);

    await db.insert(notes).values({
      id: newId,
      title: fileTitle,
      path: filePath,
      content: rawContent,
      tags: JSON.stringify(metadata.tags),
      category: metadata.category,
      headings: JSON.stringify(metadata.headings),
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    return {
      action: "created",
      filePath,
      title: fileTitle,
      noteId: newId,
    };
  } catch (err) {
    return {
      action: "failed",
      filePath,
      title: path.basename(filePath),
      reason: (err as Error).message,
    };
  }
};

/**
 * ディレクトリ全体を同期
 */
const syncDirectory = async (
  dir: string,
  options: SyncOptions
): Promise<SyncResult[]> => {
  const files = collectFiles(dir);
  console.log(`📄 Found ${files.length} markdown files in ${dir}\n`);

  if (options.dryRun) {
    console.log("[DRY-RUN MODE] No changes will be made to the database.\n");
  }

  const results: SyncResult[] = [];

  for (const filePath of files) {
    const result = await syncFile(filePath, options);
    results.push(result);

    // 進捗表示
    const icon = {
      created: "✨",
      updated: "✔️",
      skipped: "↩️",
      failed: "❌",
    }[result.action];

    if (result.action !== "skipped" || options.verbose) {
      console.log(`${icon} [${result.action.toUpperCase()}] ${result.title}`);
      if (options.verbose && result.reason) {
        console.log(`   → ${result.reason}`);
      }
    }
  }

  return results;
};

/**
 * 結果サマリーを表示
 */
const printSummary = (results: SyncResult[]) => {
  const counts = {
    created: results.filter((r) => r.action === "created").length,
    updated: results.filter((r) => r.action === "updated").length,
    skipped: results.filter((r) => r.action === "skipped").length,
    failed: results.filter((r) => r.action === "failed").length,
  };

  console.log("\n========== Sync Summary ==========");
  console.log(`✨ Created: ${counts.created}`);
  console.log(`✔️  Updated: ${counts.updated}`);
  console.log(`↩️  Skipped: ${counts.skipped}`);
  console.log(`❌ Failed:  ${counts.failed}`);
  console.log(`──────────────────────────────────`);
  console.log(`   Total:   ${results.length}`);
  console.log("==================================\n");

  if (counts.failed > 0) {
    console.log("❌ Failed files:");
    results
      .filter((r) => r.action === "failed")
      .forEach((r) => {
        console.log(`   - ${r.filePath}: ${r.reason}`);
      });
    console.log("");
  }
};

/**
 * メイン処理
 */
const main = async () => {
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const verbose = args.includes("--verbose") || args.includes("-v");

  // オプション以外の引数からディレクトリを取得
  const targetDir = args.find((arg) => !arg.startsWith("-")) || DEFAULT_DIR;

  console.log("🔄 Brain Cabinet: Markdown → DB Sync\n");

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ Directory not found: ${targetDir}`);
    process.exit(1);
  }

  const results = await syncDirectory(targetDir, { dryRun, force, verbose });
  printSummary(results);

  const hasFailed = results.some((r) => r.action === "failed");
  process.exit(hasFailed ? 1 : 0);
};

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
