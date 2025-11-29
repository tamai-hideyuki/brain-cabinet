#!/usr/bin/env tsx
import fs from "fs";
import path from "path";
import { db } from "../db/client";
import { notes } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const SUPPORTED_EXT = [".md", ".txt", ".mdx"];

const collectFiles = (dir: string): string[] => {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(collectFiles(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
};

const importNotes = async (targetDir: string) => {
  const files = collectFiles(targetDir);
  console.log(`Found ${files.length} files.`);

  const targetFiles = files.filter((file) =>
    SUPPORTED_EXT.includes(path.extname(file))
  );
  console.log(`Target files: ${targetFiles.length}`);

  for (const filePath of targetFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const title = path.basename(filePath, path.extname(filePath));

      const exists = await db
        .select()
        .from(notes)
        .where(eq(notes.path, filePath))
        .limit(1);

      if (exists.length > 0) {
        // 更新
        await db
          .update(notes)
          .set({
            title,
            content,
            updatedAt: Math.floor(Date.now() / 1000),
          })
          .where(eq(notes.path, filePath));
        console.log(`✔ Updated: ${title}`);
      } else {
        // 新規
        await db.insert(notes).values({
          id: randomUUID(),
          title,
          path: filePath,
          content,
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        });
        console.log(`✔ Imported: ${title}`);
      }
    } catch (err) {
      console.error(`Failed: ${filePath}`, err);
    }
  }

  console.log("Import finished!");
};

const target = process.argv[2];

if (!target) {
  console.error("Usage: pnpm import-notes <directory>");
  process.exit(1);
}

importNotes(target);
