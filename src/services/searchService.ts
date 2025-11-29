import { searchNotesInDB } from "../repositories/searchRepo";
import { normalizeText } from "../utils/normalize";
import TinySegmenter from "tiny-segmenter";

const segmenter = new TinySegmenter();

// 形態素解析
const tokenize = (text: string): string[] => {
  return segmenter.segment(text);
};

// -------------------------------------
// snippet生成
// -------------------------------------
const makeSnippet = (content: string, query: string, length = 80) => {
  const text = normalizeText(content);
  const lower = text.toLowerCase();
  const q = query.toLowerCase();

  const idx = lower.indexOf(q);
  if (idx === -1) return text.slice(0, length) + "...";

  const start = Math.max(0, idx - length / 2);
  const end = Math.min(text.length, idx + length / 2);
  const snippet = text.slice(start, end);

  return snippet.replace(new RegExp(query, "gi"), (m) => `<mark>${m}</mark>`) + "...";
};

// -------------------------------------
// スコア計算（ベース）
// -------------------------------------
const computeBaseScore = (note: any, query: string): number => {
  const q = query.toLowerCase();
  const title = note.title.toLowerCase();
  const content = note.content.toLowerCase();
  let score = 0;

  if (title === q) score += 5;
  if (title.includes(q)) score += 3;

  const count = content.split(q).length - 1;
  score += count * 2;

  const age = Math.floor(Date.now() / 1000) - note.updatedAt;
  const recency = Math.max(0, 1 - age / (60 * 60 * 24 * 30));
  score += recency;

  return score;
};

// -------------------------------------
// 🔥 形態素解析スコア追加
// -------------------------------------
const computeTokenScore = (note: any, tokens: string[]): number => {
  const text = normalizeText(note.content).toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (token.length < 2) continue; // 1文字は弱いので無視
    const count = text.split(token).length - 1;
    score += count * 1.5;
  }

  return score;
};

// -------------------------------------
// 検索本体
// -------------------------------------
export const searchNotes = async (query: string) => {
  const raw = await searchNotesInDB(query);

  // 🔥 クエリを形態素解析
  const tokens = tokenize(query.toLowerCase()).filter((t) => t.length >= 2);

  const results = raw.map((note) => {
    const baseScore = computeBaseScore(note, query);
    const tokenScore = computeTokenScore(note, tokens);

    return {
      ...note,
      snippet: makeSnippet(note.content, query),
      score: Number((baseScore + tokenScore).toFixed(2)),
    };
  });

  return results.sort((a, b) => b.score - a.score);
};
