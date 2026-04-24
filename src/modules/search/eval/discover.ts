/**
 * ゴールデンセット作成補助スクリプト
 *
 * クエリを与えると3モードそれぞれの上位候補をタイトル付きで表示する。
 * 見てrelevantな note_id を選んでgolden.jsonlに転記する。
 *
 * 使い方:
 *   pnpm eval:discover "TypeScriptの型推論"
 *   pnpm eval:discover "朝の生産性" --top 30
 */

import {
  searchNotes,
  searchNotesSemantic,
  searchNotesHybrid,
} from "../service";

type Candidate = {
  id: string;
  title: string;
  snippet?: string;
};

const DEFAULT_TOP_N = 20;
const GOLDEN_HINT_MAX_IDS = 10;
const SNIPPET_MAX_LENGTH = 80;

type ParsedArgs = {
  query: string;
  topN: number;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const query = argv.find((arg) => !arg.startsWith("--"));
  if (!query) {
    console.error('usage: pnpm eval:discover "<query>" [--top N]');
    process.exit(1);
  }

  const topFlagIndex = argv.indexOf("--top");
  if (topFlagIndex < 0) {
    return { query, topN: DEFAULT_TOP_N };
  }

  const rawValue = argv[topFlagIndex + 1];
  const topN = rawValue !== undefined ? parseInt(rawValue, 10) : NaN;
  if (Number.isNaN(topN)) {
    console.error("--top requires a numeric value (e.g. --top 30)");
    process.exit(1);
  }

  return { query, topN };
};

const deduplicate = (candidates: Candidate[]): Candidate[] => {
  const seen = new Set<string>();
  const unique: Candidate[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    unique.push(candidate);
  }
  return unique;
};

const formatSnippet = (text: string | undefined, maxLength = SNIPPET_MAX_LENGTH): string => {
  if (!text) return "";
  const cleaned = text.replace(/<\/?mark>/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + "..." : cleaned;
};

const printResults = (name: string, results: Candidate[], topN: number) => {
  console.log(`### ${name} (${results.length} total)`);
  const shown = results.slice(0, topN);
  for (const [index, candidate] of shown.entries()) {
    console.log(`  ${String(index + 1).padStart(2)}. ${candidate.id}  ${candidate.title}`);
    if (candidate.snippet) console.log(`      ${formatSnippet(candidate.snippet)}`);
  }
  console.log("");
};

const main = async () => {
  const { query, topN } = parseArgs(process.argv.slice(2));

  console.log(`🔎 Query: "${query}"  (top ${topN} per mode)\n`);

  const [keywordResults, semanticResults, hybridResults] = await Promise.all([
    searchNotes(query),
    searchNotesSemantic(query),
    searchNotesHybrid(query),
  ]);

  printResults("keyword", keywordResults, topN);
  printResults("semantic", semanticResults, topN);
  printResults("hybrid", hybridResults, topN);

  const union = deduplicate([...keywordResults, ...semanticResults, ...hybridResults]);
  console.log(`### Union (unique across modes): ${union.length} notes`);
  console.log("\n💡 Copy the relevant note IDs below into golden.jsonl:");
  console.log(
    JSON.stringify({
      query,
      relevant: union.slice(0, GOLDEN_HINT_MAX_IDS).map((candidate) => candidate.id),
      notes: "TODO: filter to actually relevant IDs",
    })
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
