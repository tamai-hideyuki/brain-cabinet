/**
 * Knowledge検索サービス
 * - FTS5によるキーワード検索
 * - TF-IDFスコアリング
 * - Semantic検索
 * - Hybrid検索（keyword + semantic）
 */
import { db } from "../db/client";
import { knowledgeNotes, knowledgeEmbeddings } from "../db/schema";
import { eq, isNull, sql, desc, and, inArray } from "drizzle-orm";
import type { KnowledgeNote } from "../db/schema";
import pino from "pino";

const log = pino({ name: "knowledge-search" });

// 検索結果型
export type SearchResult = {
  note: KnowledgeNote;
  score: number;
  snippet: string;
  matchType: "keyword" | "semantic" | "hybrid";
};

// ========== FTS5 セットアップ ==========

/**
 * FTS5テーブルを作成（存在しない場合）
 * シンプルなスタンドアロンFTS5テーブル（Cabinetと同じ方式）
 */
export const setupFTS = async (): Promise<void> => {
  try {
    await db.run(sql`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        content,
        source,
        category,
        tags
      )
    `);
    log.info("FTS5 setup completed");
  } catch (err) {
    log.error({ err }, "Failed to setup FTS5");
    throw err;
  }
};

/**
 * 既存データをFTSに再インデックス
 */
export const rebuildFTSIndex = async (): Promise<number> => {
  // FTSテーブルが存在しない場合は作成
  await setupFTS();

  // FTSテーブルをクリア
  await db.run(sql`DELETE FROM knowledge_notes_fts`);

  // 全ノートを取得してFTSに挿入
  const notes = await db
    .select()
    .from(knowledgeNotes)
    .where(isNull(knowledgeNotes.deletedAt));

  for (const note of notes) {
    await db.run(sql`
      INSERT INTO knowledge_notes_fts(note_id, title, content, source, category, tags)
      VALUES (${note.id}, ${note.title}, ${note.content}, ${note.source}, ${note.category}, ${note.tags})
    `);
  }

  log.info({ count: notes.length }, "FTS index rebuilt");
  return notes.length;
};

/**
 * ノートをFTSに追加/更新
 */
export const updateFTSForNote = async (noteId: string): Promise<void> => {
  const [note] = await db
    .select()
    .from(knowledgeNotes)
    .where(eq(knowledgeNotes.id, noteId));

  if (!note || note.deletedAt) {
    // 削除済みまたは存在しない場合はFTSから削除
    await db.run(sql`DELETE FROM knowledge_notes_fts WHERE note_id = ${noteId}`);
    return;
  }

  // 既存のエントリを削除
  await db.run(sql`DELETE FROM knowledge_notes_fts WHERE note_id = ${noteId}`);

  // 新しいエントリを追加
  await db.run(sql`
    INSERT INTO knowledge_notes_fts(note_id, title, content, source, category, tags)
    VALUES (${note.id}, ${note.title}, ${note.content}, ${note.source}, ${note.category}, ${note.tags})
  `);
};

/**
 * ノートをFTSから削除
 */
export const deleteFTSForNote = async (noteId: string): Promise<void> => {
  await db.run(sql`DELETE FROM knowledge_notes_fts WHERE note_id = ${noteId}`);
};

// ========== キーワード検索 ==========

/**
 * FTS5によるキーワード検索
 */
export const searchKeyword = async (
  query: string,
  limit = 20
): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  // クエリをトークン化してFTS5用に変換（Cabinetと同じ形式）
  // 特殊文字を除去し、各単語に前方一致(*)を付与
  const sanitized = query
    .trim()
    .replace(/['"(){}[\]*:^~!@#$%&\\/.+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sanitized) return [];

  const ftsQuery = sanitized
    .split(" ")
    .filter((t) => t.length > 0)
    .map((term) => `${term}*`)
    .join(" ");

  try {
    // FTS5検索
    const ftsResults = await db.all<{ note_id: string; rank: number }>(sql`
      SELECT note_id, rank
      FROM knowledge_notes_fts
      WHERE knowledge_notes_fts MATCH ${ftsQuery}
      ORDER BY rank
      LIMIT ${limit}
    `);

    if (ftsResults.length === 0) {
      // FTSで見つからない場合はLIKEフォールバック
      return searchLikeFallback(query, limit);
    }

    // ノート情報を取得
    const noteIds = ftsResults.map((r) => r.note_id);
    const notes = await db
      .select()
      .from(knowledgeNotes)
      .where(
        and(
          inArray(knowledgeNotes.id, noteIds),
          isNull(knowledgeNotes.deletedAt)
        )
      );

    // スコアとスニペットを付与
    const results: SearchResult[] = notes.map((note) => {
      const ftsResult = ftsResults.find((r) => r.note_id === note.id);
      const score = calculateTFIDFScore(note, query, ftsResult?.rank || 0);
      const snippet = generateSnippet(note.content, query);

      return {
        note,
        score,
        snippet,
        matchType: "keyword" as const,
      };
    });

    return results.sort((a, b) => b.score - a.score);
  } catch (err) {
    log.error({ err, query }, "FTS search failed, using fallback");
    return searchLikeFallback(query, limit);
  }
};

/**
 * LIKEフォールバック検索
 */
const searchLikeFallback = async (
  query: string,
  limit: number
): Promise<SearchResult[]> => {
  const pattern = `%${query}%`;

  const notes = await db
    .select()
    .from(knowledgeNotes)
    .where(
      and(
        isNull(knowledgeNotes.deletedAt),
        sql`(${knowledgeNotes.title} LIKE ${pattern} OR ${knowledgeNotes.content} LIKE ${pattern})`
      )
    )
    .orderBy(desc(knowledgeNotes.updatedAt))
    .limit(limit);

  return notes.map((note) => ({
    note,
    score: calculateTFIDFScore(note, query, 0),
    snippet: generateSnippet(note.content, query),
    matchType: "keyword" as const,
  }));
};

/**
 * TF-IDFスコアを計算
 */
const calculateTFIDFScore = (
  note: KnowledgeNote,
  query: string,
  ftsRank: number
): number => {
  const terms = query.toLowerCase().split(/\s+/);
  let score = 0;

  // タイトルマッチ（重み: 3x）
  const titleLower = note.title.toLowerCase();
  for (const term of terms) {
    if (titleLower.includes(term)) {
      score += titleLower === term ? 15 : 9; // 完全一致 vs 部分一致
    }
  }

  // コンテンツマッチ（重み: 1x）
  const contentLower = note.content.toLowerCase();
  for (const term of terms) {
    const matches = (contentLower.match(new RegExp(term, "gi")) || []).length;
    score += Math.min(matches, 5); // 最大5回までカウント
  }

  // FTSランクを加味
  if (ftsRank < 0) {
    score += Math.abs(ftsRank) * 2;
  }

  // 新しさボーナス
  const daysSinceUpdate = (Date.now() - note.updatedAt) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) score += 3;
  else if (daysSinceUpdate < 30) score += 1;

  return score;
};

/**
 * スニペットを生成
 */
const generateSnippet = (content: string, query: string, maxLength = 150): string => {
  const terms = query.toLowerCase().split(/\s+/);
  const contentLower = content.toLowerCase();

  // 最初のマッチ位置を見つける
  let firstMatchPos = -1;
  for (const term of terms) {
    const pos = contentLower.indexOf(term);
    if (pos !== -1 && (firstMatchPos === -1 || pos < firstMatchPos)) {
      firstMatchPos = pos;
    }
  }

  if (firstMatchPos === -1) {
    // マッチがない場合は先頭から
    return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
  }

  // マッチ周辺を抽出
  const start = Math.max(0, firstMatchPos - 30);
  const end = Math.min(content.length, firstMatchPos + maxLength - 30);
  let snippet = content.slice(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet += "...";

  // マッチ部分をハイライト
  for (const term of terms) {
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    snippet = snippet.replace(regex, "<mark>$1</mark>");
  }

  return snippet;
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ========== Embedding管理 ==========

import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

let embedder: FeatureExtractionPipeline | null = null;
let isModelLoading = false;

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_VERSION = 1;

/**
 * Embeddingモデルを取得（遅延ロード）
 */
const getEmbedder = async (): Promise<FeatureExtractionPipeline> => {
  if (embedder) return embedder;

  if (isModelLoading) {
    while (isModelLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (embedder) return embedder;
  }

  isModelLoading = true;
  try {
    log.info("Loading MiniLM model...");
    embedder = await pipeline("feature-extraction", MODEL_NAME);
    log.info("MiniLM model loaded");
    return embedder;
  } finally {
    isModelLoading = false;
  }
};

/**
 * テキストからEmbeddingを生成
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const normalized = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  const model = await getEmbedder();
  const output = await model(normalized, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
};

/**
 * ノートのEmbeddingを保存
 */
export const saveNoteEmbedding = async (noteId: string): Promise<void> => {
  const [note] = await db
    .select()
    .from(knowledgeNotes)
    .where(eq(knowledgeNotes.id, noteId));

  if (!note) throw new Error(`Note not found: ${noteId}`);

  const text = `${note.title}\n\n${note.content}`;
  const embedding = await generateEmbedding(text);
  const now = Date.now();

  // Upsert
  await db
    .insert(knowledgeEmbeddings)
    .values({
      noteId,
      embedding: JSON.stringify(embedding),
      model: MODEL_NAME,
      version: EMBEDDING_VERSION,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: knowledgeEmbeddings.noteId,
      set: {
        embedding: JSON.stringify(embedding),
        updatedAt: now,
      },
    });

  log.debug({ noteId }, "Embedding saved");
};

/**
 * ノートのEmbeddingを削除
 */
export const deleteNoteEmbedding = async (noteId: string): Promise<void> => {
  await db
    .delete(knowledgeEmbeddings)
    .where(eq(knowledgeEmbeddings.noteId, noteId));
};

/**
 * Cosine類似度を計算
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
};

// ========== セマンティック検索 ==========

/**
 * セマンティック検索
 */
export const searchSemantic = async (
  query: string,
  limit = 20
): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  // クエリのEmbeddingを生成
  const queryEmbedding = await generateEmbedding(query);

  // 全Embeddingを取得して類似度計算
  const allEmbeddings = await db.select().from(knowledgeEmbeddings);

  if (allEmbeddings.length === 0) {
    log.warn("No embeddings found, falling back to keyword search");
    return searchKeyword(query, limit);
  }

  // 類似度計算
  const similarities = allEmbeddings.map((e) => ({
    noteId: e.noteId,
    similarity: cosineSimilarity(queryEmbedding, JSON.parse(e.embedding)),
  }));

  // 上位を取得
  const topResults = similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  // ノート情報を取得
  const noteIds = topResults.map((r) => r.noteId);
  const notes = await db
    .select()
    .from(knowledgeNotes)
    .where(
      and(
        inArray(knowledgeNotes.id, noteIds),
        isNull(knowledgeNotes.deletedAt)
      )
    );

  // 結果を構築
  const results: SearchResult[] = notes.map((note) => {
    const sim = topResults.find((r) => r.noteId === note.id);
    return {
      note,
      score: (sim?.similarity || 0) * 100,
      snippet: generateSnippet(note.content, query),
      matchType: "semantic" as const,
    };
  });

  return results.sort((a, b) => b.score - a.score);
};

// ========== ハイブリッド検索 ==========

/**
 * ハイブリッド検索（keyword 60% + semantic 40%）
 */
export const searchHybrid = async (
  query: string,
  limit = 20
): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  // 両方の検索を並列実行
  const [keywordResults, semanticResults] = await Promise.all([
    searchKeyword(query, limit * 2),
    searchSemantic(query, limit * 2),
  ]);

  // スコアを正規化して統合
  const maxKeywordScore = Math.max(...keywordResults.map((r) => r.score), 1);
  const maxSemanticScore = Math.max(...semanticResults.map((r) => r.score), 1);

  const scoreMap = new Map<string, { keyword: number; semantic: number; note: KnowledgeNote; snippet: string }>();

  for (const result of keywordResults) {
    scoreMap.set(result.note.id, {
      keyword: result.score / maxKeywordScore,
      semantic: 0,
      note: result.note,
      snippet: result.snippet,
    });
  }

  for (const result of semanticResults) {
    const existing = scoreMap.get(result.note.id);
    if (existing) {
      existing.semantic = result.score / maxSemanticScore;
    } else {
      scoreMap.set(result.note.id, {
        keyword: 0,
        semantic: result.score / maxSemanticScore,
        note: result.note,
        snippet: result.snippet,
      });
    }
  }

  // ハイブリッドスコア計算（keyword 60% + semantic 40%）
  const results: SearchResult[] = Array.from(scoreMap.values()).map(
    ({ keyword, semantic, note, snippet }) => ({
      note,
      score: keyword * 0.6 + semantic * 0.4,
      snippet,
      matchType: "hybrid" as const,
    })
  );

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
};

// ========== 全ノートのEmbedding生成 ==========

/**
 * 全ノートのEmbeddingを一括生成
 */
export const generateAllEmbeddings = async (): Promise<{
  success: number;
  failed: number;
}> => {
  const notes = await db
    .select()
    .from(knowledgeNotes)
    .where(isNull(knowledgeNotes.deletedAt));

  let success = 0;
  let failed = 0;

  for (const note of notes) {
    try {
      await saveNoteEmbedding(note.id);
      success++;
    } catch (err) {
      log.error({ err, noteId: note.id }, "Failed to generate embedding");
      failed++;
    }
  }

  log.info({ success, failed }, "Embedding generation completed");
  return { success, failed };
};
