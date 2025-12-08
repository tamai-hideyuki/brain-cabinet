import { searchNotesInDB, SearchOptions } from "../../repositories/searchRepo";
import { findAllNotes } from "../../repositories/notesRepo";
import { normalizeText } from "../../utils/normalize";
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
// TTLは削除: Write-through方式に移行
// ノートのCRUD操作時にinvalidateIDFCache()を呼び出す

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
  // Write-through方式: キャッシュがなければ構築
  // 無効化はinvalidateIDFCache()で明示的に行う
  if (!idfCache) {
    idfCache = await buildIDFCache();
  }
  return idfCache;
};

// -------------------------------------
// snippet生成（句境界ベース + <mark>強調）
// -------------------------------------

// 句境界で分割（句点、読点+改行、改行で区切る）
const splitSentences = (text: string): string[] => {
  // 句点（。！？）、または改行で分割
  return text
    .split(/(?<=[。！？\n])|(?=\n)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

// クエリ語を<mark>タグで囲む
const highlightQuery = (text: string, query: string): string => {
  const q = query.toLowerCase();
  const queryTokens = tokenize(q).filter((t) => t.length >= 2);

  let result = text;
  for (const token of queryTokens) {
    // 大文字小文字を無視して置換（元のケースを保持）
    const regex = new RegExp(`(${escapeRegex(token)})`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  }
  return result;
};

// 正規表現エスケープ
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// 文字位置ベースのsnippet（前後40-80字）
const makeCharSnippet = (
  content: string,
  query: string,
  contextBefore = 40,
  contextAfter = 60
): string => {
  const text = normalizeText(content);
  const lowerText = text.toLowerCase();
  const q = query.toLowerCase();

  // クエリ全体での検索
  let matchIndex = lowerText.indexOf(q);

  // 見つからない場合はトークン単位で検索
  if (matchIndex === -1) {
    const queryTokens = tokenize(q).filter((t) => t.length >= 2);
    for (const token of queryTokens) {
      const idx = lowerText.indexOf(token);
      if (idx !== -1) {
        matchIndex = idx;
        break;
      }
    }
  }

  if (matchIndex === -1) {
    // 見つからない場合は先頭から
    const snippet = text.slice(0, contextBefore + contextAfter);
    return snippet + (text.length > snippet.length ? "..." : "");
  }

  // 前後の文字を抽出
  const start = Math.max(0, matchIndex - contextBefore);
  const end = Math.min(text.length, matchIndex + query.length + contextAfter);

  // 句境界に調整（可能であれば）
  let adjustedStart = start;
  let adjustedEnd = end;

  // 開始位置を句境界に調整（前方の句点を探す）
  if (start > 0) {
    const beforeText = text.slice(Math.max(0, start - 20), start);
    const sentenceBreak = beforeText.search(/[。！？\n][^。！？\n]*$/);
    if (sentenceBreak !== -1) {
      adjustedStart = Math.max(0, start - 20) + sentenceBreak + 1;
    }
  }

  // 終了位置を句境界に調整（後方の句点を探す）
  if (end < text.length) {
    const afterText = text.slice(end, Math.min(text.length, end + 20));
    const sentenceBreak = afterText.search(/[。！？\n]/);
    if (sentenceBreak !== -1) {
      adjustedEnd = end + sentenceBreak + 1;
    }
  }

  const snippet = text.slice(adjustedStart, adjustedEnd);
  const prefix = adjustedStart > 0 ? "..." : "";
  const suffix = adjustedEnd < text.length ? "..." : "";

  return prefix + snippet + suffix;
};

// 文ベースのsnippet（クエリを含む文を抽出）
const makeSentenceSnippet = (
  content: string,
  query: string,
  maxLength = 100
): string | null => {
  const sentences = splitSentences(content);
  const q = query.toLowerCase();
  const queryTokens = tokenize(q).filter((t) => t.length >= 2);

  // クエリ全体を含む文を探す
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(q)) {
      if (sentence.length <= maxLength) {
        return sentence;
      }
      // 長い場合は文字ベースにフォールバック
      return null;
    }
  }

  // トークン単位で含む文を探す
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const token of queryTokens) {
      if (lowerSentence.includes(token)) {
        if (sentence.length <= maxLength) {
          return sentence;
        }
        return null;
      }
    }
  }

  return null;
};

// メインのsnippet生成（<mark>強調付き）
const makeSnippet = (content: string, query: string): string => {
  // 1. 文ベースを試す
  const sentenceSnippet = makeSentenceSnippet(content, query);
  if (sentenceSnippet) {
    return highlightQuery(sentenceSnippet, query);
  }

  // 2. 文字位置ベースにフォールバック
  const charSnippet = makeCharSnippet(content, query);
  return highlightQuery(charSnippet, query);
};

// -------------------------------------
// TF-IDF統合スコア（タイトル・見出しの重みづけ強化）
// -------------------------------------
const computeTFIDFScore = (
  note: any,
  tokens: string[],
  idfMap: Map<string, number>
): number => {
  const contentText = normalizeText(note.content).toLowerCase();
  const titleText = note.title.toLowerCase();

  // 見出しをパース
  const headings: string[] = note.headings ? JSON.parse(note.headings) : [];
  const headingsText = headings.join(" ").toLowerCase();

  let score = 0;

  for (const token of tokens) {
    if (token.length < 2) continue;
    const idf = idfMap.get(token) || 0;

    // 本文での出現
    const contentCount = contentText.split(token).length - 1;
    if (contentCount > 0) {
      const tf = 1 + Math.log(contentCount);
      score += tf * idf * 1.0; // 本文: 基本重み
    }

    // タイトルでの出現（重み3倍）
    const titleCount = titleText.split(token).length - 1;
    if (titleCount > 0) {
      const tf = 1 + Math.log(titleCount);
      score += tf * idf * 3.0; // タイトル: 3倍
    }

    // 見出しでの出現（重み2倍）
    const headingCount = headingsText.split(token).length - 1;
    if (headingCount > 0) {
      const tf = 1 + Math.log(headingCount);
      score += tf * idf * 2.0; // 見出し: 2倍
    }
  }

  return score;
};

// -------------------------------------
// ノート長さ補正（短文ペナルティ）
// -------------------------------------
const computeLengthScore = (note: any): number => {
  const length = note.content.length;

  // 100文字未満: ペナルティ
  if (length < 100) return -1.0;
  // 100-300文字: 軽いペナルティ
  if (length < 300) return -0.5;
  // 300-1000文字: ニュートラル
  if (length < 1000) return 0;
  // 1000文字以上: 少しボーナス
  return 0.5;
};

// -------------------------------------
// 構造スコア（タイトル・見出し一致）
// -------------------------------------
const computeStructureScore = (note: any, query: string): number => {
  const q = query.toLowerCase();
  const title = note.title.toLowerCase();
  let score = 0;

  // タイトル一致
  if (title === q) score += 5; // 完全一致
  else if (title.includes(q)) score += 3; // 部分一致

  // 見出し一致
  const headings: string[] = note.headings ? JSON.parse(note.headings) : [];
  for (const heading of headings) {
    const h = heading.toLowerCase();
    if (h === q) {
      score += 3; // 見出し完全一致
      break;
    } else if (h.includes(q)) {
      score += 1.5; // 見出し部分一致
    }
  }

  return score;
};

// -------------------------------------
// 新規性スコア（Recency）
// -------------------------------------
const computeRecencyScore = (note: any): number => {
  const age = Math.floor(Date.now() / 1000) - note.updatedAt;
  const daysSinceUpdate = age / (60 * 60 * 24);

  // 7日以内 → 高スコア
  if (daysSinceUpdate <= 7) return 1.0;
  // 30日以内 → 中スコア
  if (daysSinceUpdate <= 30) return 0.5;
  // 90日以内 → 低スコア
  if (daysSinceUpdate <= 90) return 0.2;
  // それ以降
  return 0;
};

// -------------------------------------
// カテゴリ・タグ一致スコア
// -------------------------------------
const computeMetadataScore = (
  note: any,
  query: string,
  options?: SearchOptions
): number => {
  let score = 0;
  const q = query.toLowerCase();

  // カテゴリがクエリに含まれる場合
  if (note.category && note.category.toLowerCase().includes(q)) {
    score += 2;
  }

  // フィルターで指定されたカテゴリと一致
  if (options?.category && note.category === options.category) {
    score += 1;
  }

  // タグ一致
  const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
  for (const tag of tags) {
    const t = tag.toLowerCase();
    if (t === q) {
      score += 3; // タグ完全一致
    } else if (t.includes(q) || q.includes(t)) {
      score += 1; // タグ部分一致
    }
  }

  // フィルターで指定されたタグと一致
  if (options?.tags) {
    for (const filterTag of options.tags) {
      if (tags.some((t) => t.toLowerCase() === filterTag.toLowerCase())) {
        score += 0.5;
      }
    }
  }

  return score;
};

// -------------------------------------
// JSON配列パース（安全に）
// -------------------------------------
const parseJsonArray = (jsonStr: string | null): string[] => {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// -------------------------------------
// 検索本体
// -------------------------------------
export const searchNotes = async (query: string, options?: SearchOptions) => {
  const raw = await searchNotesInDB(query, options);
  const { idfMap } = await getIDFCache();

  // クエリを形態素解析
  const tokens = tokenize(query.toLowerCase()).filter((t) => t.length >= 2);

  const results = raw.map((note) => {
    // 各スコアを計算
    const tfidfScore = computeTFIDFScore(note, tokens, idfMap);
    const structureScore = computeStructureScore(note, query);
    const recencyScore = computeRecencyScore(note);
    const lengthScore = computeLengthScore(note);
    const metadataScore = computeMetadataScore(note, query, options);

    // 重み付け合計
    const totalScore =
      tfidfScore * 2.0 +       // TF-IDF（メイン）
      structureScore * 1.5 +   // 構造（タイトル・見出し一致）
      recencyScore * 0.5 +     // 新規性
      lengthScore * 0.3 +      // 長さ補正
      metadataScore * 1.0;     // カテゴリ・タグ一致

    return {
      ...note,
      tags: parseJsonArray(note.tags),
      headings: parseJsonArray(note.headings),
      snippet: makeSnippet(note.content, query),
      score: Number(totalScore.toFixed(2)),
      _debug: {
        tfidf: Number(tfidfScore.toFixed(2)),
        structure: Number(structureScore.toFixed(2)),
        recency: Number(recencyScore.toFixed(2)),
        length: Number(lengthScore.toFixed(2)),
        metadata: Number(metadataScore.toFixed(2)),
      },
    };
  });

  return results.sort((a, b) => b.score - a.score);
};

// -------------------------------------
// IDFキャッシュを無効化（Write-through方式）
// ノートのCRUD操作時に呼び出す
// -------------------------------------
export const invalidateIDFCache = () => {
  idfCache = null;
};

// 旧名称（後方互換性のため）
export const clearIDFCache = invalidateIDFCache;

// -------------------------------------
// 意味検索（Semantic Search）
// -------------------------------------
import { searchSimilarNotes } from "../embeddingService";
import { findNoteById } from "../../repositories/notesRepo";

export const searchNotesSemantic = async (
  query: string,
  options?: { category?: string; tags?: string[] }
) => {
  // Embeddingベースで類似ノートを検索
  const similarResults = await searchSimilarNotes(query, 20);

  if (similarResults.length === 0) {
    return [];
  }

  // ノート詳細を取得
  const results = await Promise.all(
    similarResults.map(async ({ noteId, similarity }) => {
      const note = await findNoteById(noteId);
      if (!note) return null;

      return {
        ...note,
        tags: parseJsonArray(note.tags),
        headings: parseJsonArray(note.headings),
        snippet: makeSnippet(note.content, query),
        score: Number((similarity * 100).toFixed(2)), // 0-100スケール
        _debug: {
          similarity: Number(similarity.toFixed(4)),
          mode: "semantic",
        },
      };
    })
  );

  // null除去 & フィルター適用
  let filtered = results.filter((r): r is NonNullable<typeof r> => r !== null);

  // カテゴリフィルター
  if (options?.category) {
    filtered = filtered.filter((note) => note.category === options.category);
  }

  // タグフィルター
  if (options?.tags && options.tags.length > 0) {
    filtered = filtered.filter((note) => {
      const noteTags = note.tags.map((t: string) => t.toLowerCase());
      return options.tags!.every((tag) =>
        noteTags.some((nt: string) => nt.includes(tag.toLowerCase()))
      );
    });
  }

  return filtered;
};

// -------------------------------------
// ハイブリッド検索（キーワード + セマンティック）
// -------------------------------------
import type { Category } from "../../db/schema";

export interface HybridSearchOptions {
  category?: Category;
  tags?: string[];
  keywordWeight?: number;  // デフォルト 0.6
  semanticWeight?: number; // デフォルト 0.4
}

/**
 * キーワード検索とセマンティック検索を組み合わせたハイブリッド検索
 * 両方の結果をマージし、重み付けスコアでソート
 */
export const searchNotesHybrid = async (
  query: string,
  options?: HybridSearchOptions
) => {
  const keywordWeight = options?.keywordWeight ?? 0.6;
  const semanticWeight = options?.semanticWeight ?? 0.4;

  const searchOptions = {
    category: options?.category,
    tags: options?.tags,
  };

  // 並行実行
  const [keywordResults, semanticResults] = await Promise.all([
    searchNotes(query, searchOptions),
    searchNotesSemantic(query, searchOptions),
  ]);

  // 結果をマージ（IDをキーにスコアを統合）
  const merged = new Map<string, { note: unknown; score: number; sources: string[] }>();

  for (const note of keywordResults as Array<{ id: string; score: number }>) {
    merged.set(note.id, {
      note,
      score: note.score * keywordWeight,
      sources: ["keyword"],
    });
  }

  for (const note of semanticResults as Array<{ id: string; score: number }>) {
    const existing = merged.get(note.id);
    if (existing) {
      existing.score += note.score * semanticWeight;
      existing.sources.push("semantic");
    } else {
      merged.set(note.id, {
        note,
        score: note.score * semanticWeight,
        sources: ["semantic"],
      });
    }
  }

  // スコア順にソートして返す
  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      ...item.note as object,
      hybridScore: Number(item.score.toFixed(2)),
      _hybridSources: item.sources,
    }));
};
