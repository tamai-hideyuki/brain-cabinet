import { searchNotesInDB } from "../repositories/searchRepo";
import { findAllNotes } from "../repositories/notesRepo";
import { normalizeText } from "../utils/normalize";
import TinySegmenter from "tiny-segmenter";

const segmenter = new TinySegmenter();

// 形態素解析
const tokenize = (text: string): string[] => {
  return segmenter.segment(text);
};

// -------------------------------------
// IDF キャッシュ（メモリ内）
// -------------------------------------
type IDFCache = {
  idfMap: Map<string, number>;
  totalDocs: number;
  lastUpdated: number;
};

let idfCache: IDFCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5分

// -------------------------------------
// IDF計算（全ノートをスキャン）
// -------------------------------------
const buildIDFCache = async (): Promise<IDFCache> => {
  const allNotes = await findAllNotes();
  const N = allNotes.length;
  const docFreq = new Map<string, number>(); // token → 出現ドキュメント数

  // 各ノートをトークン化し、ドキュメント頻度をカウント
  for (const note of allNotes) {
    const text = normalizeText(note.content).toLowerCase();
    const tokens = tokenize(text);
    const uniqueTokens = new Set(tokens.filter((t) => t.length >= 2));

    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  // IDF値を計算: log(N / df)
  const idfMap = new Map<string, number>();
  for (const [token, df] of docFreq) {
    idfMap.set(token, Math.log(N / df));
  }

  return {
    idfMap,
    totalDocs: N,
    lastUpdated: Date.now(),
  };
};

const getIDFCache = async (): Promise<IDFCache> => {
  const now = Date.now();
  if (!idfCache || now - idfCache.lastUpdated > CACHE_TTL) {
    idfCache = await buildIDFCache();
  }
  return idfCache;
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
// TF-IDF統合スコア
// -------------------------------------
const computeTFIDFScore = (
  note: any,
  tokens: string[],
  idfMap: Map<string, number>
): number => {
  const text = normalizeText(note.content).toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (token.length < 2) continue;
    const count = text.split(token).length - 1;
    if (count > 0) {
      const tf = 1 + Math.log(count);
      const idf = idfMap.get(token) || 0;
      score += tf * idf; // TF-IDF
    }
  }

  return score;
};

// -------------------------------------
// C. 構造スコア（タイトル一致など）
// -------------------------------------
const computeStructureScore = (note: any, query: string): number => {
  const q = query.toLowerCase();
  const title = note.title.toLowerCase();
  let score = 0;

  if (title === q) score += 5; // 完全一致
  else if (title.includes(q)) score += 3; // 部分一致

  return score;
};

// -------------------------------------
// D. 新規性スコア（Recency）
// -------------------------------------
const computeRecencyScore = (note: any): number => {
  const age = Math.floor(Date.now() / 1000) - note.updatedAt;
  const daysSinceUpdate = age / (60 * 60 * 24);

  // 30日以内 → 高スコア、それ以降は減衰
  return Math.max(0, 1 - daysSinceUpdate / 30);
};

// -------------------------------------
// 検索本体
// -------------------------------------
export const searchNotes = async (query: string) => {
  const raw = await searchNotesInDB(query);
  const { idfMap } = await getIDFCache();

  // クエリを形態素解析
  const tokens = tokenize(query.toLowerCase()).filter((t) => t.length >= 2);

  const results = raw.map((note) => {
    // 各スコアを計算
    const tfidfScore = computeTFIDFScore(note, tokens, idfMap);
    const structureScore = computeStructureScore(note, query);
    const recencyScore = computeRecencyScore(note);

    // 重み付け合計
    const totalScore =
      tfidfScore * 2.0 + // TF-IDF（メイン）
      structureScore * 1.5 + // 構造（タイトル一致）
      recencyScore * 0.5; // 新規性

    return {
      ...note,
      snippet: makeSnippet(note.content, query),
      score: Number(totalScore.toFixed(2)),
      // デバッグ用（必要なら削除）
      _debug: {
        tfidf: Number(tfidfScore.toFixed(2)),
        structure: structureScore,
        recency: Number(recencyScore.toFixed(2)),
      },
    };
  });

  return results.sort((a, b) => b.score - a.score);
};

// -------------------------------------
// IDFキャッシュを手動でクリア（インポート後など）
// -------------------------------------
export const clearIDFCache = () => {
  idfCache = null;
};
