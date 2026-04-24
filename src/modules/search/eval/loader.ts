import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import type { GoldenEntry } from "./types";

const GOLDEN_PATH = join(
  process.cwd(),
  "src/modules/search/eval/golden.jsonl"
);

const REPORTS_DIR = join(process.cwd(), "docs/search-eval");

export const loadGoldenSet = async (path = GOLDEN_PATH): Promise<GoldenEntry[]> => {
  if (!existsSync(path)) {
    throw new Error(
      `Golden set not found at ${path}. Create it first (see docs/search-optimization-plan.md Phase 0-1).`
    );
  }
  const text = await readFile(path, "utf-8");
  const lines = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("//"));
  const entries: GoldenEntry[] = [];
  for (const [i, line] of lines.entries()) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj.query !== "string" || !Array.isArray(obj.relevant)) {
        throw new Error(`missing query or relevant`);
      }
      entries.push(obj as GoldenEntry);
    } catch (e) {
      throw new Error(`golden.jsonl line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return entries;
};

export const writeReport = async (
  filename: string,
  content: string
): Promise<string> => {
  const path = join(REPORTS_DIR, filename);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf-8");
  return path;
};
