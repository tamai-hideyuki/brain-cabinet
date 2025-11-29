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
// snippet生成（2段階: パラグラフ優先 → トークンベース）
// -------------------------------------

// パラグラフ分割（句点・改行で区切る）
const splitParagraphs = (text: string): string[] => {
  return text
    .split(/[。\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
};

// トークンベースのsnippet（前後15トークン）
const makeTokenSnippet = (content: string, query: string, contextTokens = 15): string => {
  const text = normalizeText(content);
  const tokens = tokenize(text);
  const queryTokens = tokenize(query.toLowerCase());

  // クエリトークンの位置を探す
  let matchIndex = -1;
  const lowerTokens = tokens.map((t) => t.toLowerCase());

  for (const qt of queryTokens) {
    if (qt.length < 2) continue;
    const idx = lowerTokens.findIndex((t) => t.includes(qt));
    if (idx !== -1) {
      matchIndex = idx;
      break;
    }
  }

  if (matchIndex === -1) {
    // 見つからない場合は先頭から
    return tokens.slice(0, contextTokens * 2).join("") + "...";
  }

  // 前後のトークンを抽出
  const start = Math.max(0, matchIndex - contextTokens);
  const end = Math.min(tokens.length, matchIndex + contextTokens);
  const snippetTokens = tokens.slice(start, end);

  return (start > 0 ? "..." : "") + snippetTokens.join("") + (end < tokens.length ? "..." : "");
};

// パラグラフベースのsnippet
const makeParagraphSnippet = (content: string, query: string, maxLength = 120): string | null => {
  const paragraphs = splitParagraphs(content);
  const q = query.toLowerCase();

  // クエリを含むパラグラフを探す
  for (const p of paragraphs) {
    if (p.toLowerCase().includes(q)) {
      // 長すぎる場合は切り詰め
      if (p.length > maxLength) {
        const idx = p.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - maxLength / 2);
        const end = Math.min(p.length, idx + maxLength / 2);
        return (start > 0 ? "..." : "") + p.slice(start, end) + (end < p.length ? "..." : "");
      }
      return p;
    }
  }

  return null;
};

// メインのsnippet生成
const makeSnippet = (content: string, query: string): string => {
  // 1. パラグラフベースを試す
  const paragraphSnippet = makeParagraphSnippet(content, query);
  if (paragraphSnippet) {
    return paragraphSnippet;
  }

  // 2. トークンベースにフォールバック
  return makeTokenSnippet(content, query);
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
