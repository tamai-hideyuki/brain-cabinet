/**
 * 検索品質評価ランナー
 *
 * 使い方:
 *   pnpm eval:search                # 全モード評価
 *   pnpm eval:search -- --mode hybrid  # 特定モードのみ
 *   pnpm eval:search -- --verbose   # クエリ別詳細を表示
 *
 * 出力:
 *   - 標準出力: サマリー表
 *   - docs/search-eval/YYYY-MM-DD-HHmm.md: 詳細レポート
 */

import {
  searchNotes,
  searchNotesSemantic,
  searchNotesHybrid,
} from "../service";
import { aggregate, firstRelevantRank, ndcgAtK } from "./metrics";
import { loadGoldenSet, writeReport } from "./loader";
import type {
  GoldenEntry,
  ModeReport,
  PerQueryResult,
  SearchMode,
} from "./types";

const ALL_MODES: SearchMode[] = ["keyword", "semantic", "hybrid"];

interface Args {
  modes: SearchMode[];
  verbose: boolean;
}

const parseArgs = (argv: string[]): Args => {
  const modes: SearchMode[] = [];
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") {
      const m = argv[++i] as SearchMode;
      if (!ALL_MODES.includes(m)) throw new Error(`unknown mode: ${m}`);
      modes.push(m);
    } else if (a === "--verbose") {
      verbose = true;
    }
  }
  return { modes: modes.length ? modes : [...ALL_MODES], verbose };
};

const runMode = async (
  mode: SearchMode,
  golden: GoldenEntry[]
): Promise<ModeReport> => {
  const perQuery: PerQueryResult[] = [];
  const failed: string[] = [];

  for (const entry of golden) {
    try {
      const results = await runSearch(mode, entry.query);
      const retrieved = results.map((r) => r.id);
      const relevantSet = new Set(entry.relevant);
      perQuery.push({
        query: entry.query,
        relevant: entry.relevant,
        retrieved: retrieved.slice(0, 30),
        firstRelevantRank: firstRelevantRank(retrieved, relevantSet),
        ndcg10: ndcgAtK(retrieved, relevantSet, 10),
      });
    } catch (e) {
      failed.push(`${entry.query}: ${(e as Error).message}`);
    }
  }

  const metrics = aggregate(
    perQuery.map((q) => ({
      retrieved: q.retrieved,
      relevant: new Set(q.relevant),
    }))
  );

  return { mode, metrics, perQuery, failedQueries: failed };
};

const runSearch = async (
  mode: SearchMode,
  query: string
): Promise<Array<{ id: string }>> => {
  switch (mode) {
    case "keyword":
      return searchNotes(query);
    case "semantic":
      return searchNotesSemantic(query);
    case "hybrid":
      return searchNotesHybrid(query);
  }
};

const fmt = (n: number): string => n.toFixed(4);

const renderSummaryTable = (reports: ModeReport[]): string => {
  const header = `| Mode     | NDCG@10 | MRR    | Recall@20 | Precision@10 |`;
  const sep = `|----------|---------|--------|-----------|--------------|`;
  const rows = reports.map(
    (r) =>
      `| ${r.mode.padEnd(8)} | ${fmt(r.metrics.ndcg10)}  | ${fmt(r.metrics.mrr)} | ${fmt(r.metrics.recall20)}    | ${fmt(r.metrics.precision10)}       |`
  );
  return [header, sep, ...rows].join("\n");
};

const renderPerQueryTable = (report: ModeReport): string => {
  const lines: string[] = [
    `### ${report.mode}`,
    "",
    `| Query | Rank of first match | NDCG@10 |`,
    `|-------|---------------------|---------|`,
  ];
  for (const q of report.perQuery) {
    const rank = q.firstRelevantRank === null ? "—" : String(q.firstRelevantRank);
    const query = q.query.length > 40 ? q.query.slice(0, 37) + "..." : q.query;
    lines.push(`| ${query} | ${rank} | ${fmt(q.ndcg10)} |`);
  }
  if (report.failedQueries.length > 0) {
    lines.push("", "#### Failed queries");
    for (const f of report.failedQueries) lines.push(`- ${f}`);
  }
  return lines.join("\n");
};

const timestamp = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const golden = await loadGoldenSet();

  if (golden.length === 0) {
    console.log("⚠️  golden.jsonl is empty. Add entries first.");
    process.exit(1);
  }

  console.log(`📊 Evaluating ${args.modes.join(", ")} on ${golden.length} queries...\n`);

  const reports: ModeReport[] = [];
  for (const mode of args.modes) {
    const t0 = Date.now();
    const report = await runMode(mode, golden);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  [${mode}] done in ${elapsed}s`);
    reports.push(report);
  }

  console.log("\n" + renderSummaryTable(reports) + "\n");

  if (args.verbose) {
    for (const r of reports) {
      console.log("\n" + renderPerQueryTable(r) + "\n");
    }
  }

  const ts = timestamp();
  const reportContent = [
    `# 検索評価レポート — ${ts}`,
    "",
    `Golden set: ${golden.length} queries`,
    "",
    "## Summary",
    "",
    renderSummaryTable(reports),
    "",
    "## Per-query detail",
    "",
    ...reports.map((r) => renderPerQueryTable(r)),
    "",
  ].join("\n");

  const reportPath = await writeReport(`${ts}.md`, reportContent);
  console.log(`📝 Report: ${reportPath}`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
