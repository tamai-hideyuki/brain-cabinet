import { Hono } from "hono";
import { generateEmbedding, searchSimilarNotes, cosineSimilarity } from "../../services/embeddingService";
import { getAllEmbeddings } from "../../repositories/embeddingRepo";
import { findNoteById } from "../../repositories/notesRepo";
import { ValidationError, ErrorCodes } from "../../utils/errors";

export const embedRoute = new Hono();

/**
 * POST /api/gpt/embed
 * テキストを Embedding に変換
 *
 * Body: { text: string }
 * Response: { embedding: number[], dimensions: number }
 */
embedRoute.post("/embed", async (c) => {
  const body = await c.req.json();
  const { text } = body;

  if (!text || typeof text !== "string") {
    throw new ValidationError("text is required", "text", ErrorCodes.VALIDATION_REQUIRED);
  }

  if (text.length > 10000) {
    throw new ValidationError("text is too long (max 10000 chars)", "text", ErrorCodes.VALIDATION_TOO_LONG);
  }

  const embedding = await generateEmbedding(text);

  return c.json({
    embedding,
    dimensions: embedding.length,
    model: "Xenova/all-MiniLM-L6-v2",
  });
});

/**
 * POST /api/gpt/semantic-search
 * Embedding ベースのセマンティック検索（GPT がクエリを渡すだけで検索可能）
 *
 * Body: { query: string, limit?: number }
 * Response: { results: Array<{ noteId, title, similarity, snippet }> }
 */
embedRoute.post("/semantic-search", async (c) => {
  const body = await c.req.json();
  const { query, limit = 10 } = body;

  if (!query || typeof query !== "string") {
    throw new ValidationError("query is required", "query", ErrorCodes.SEARCH_QUERY_REQUIRED);
  }

  // セマンティック検索を実行
  const similarNotes = await searchSimilarNotes(query, limit);

  // ノート詳細を取得
  const results = await Promise.all(
    similarNotes.map(async ({ noteId, similarity }) => {
      const note = await findNoteById(noteId);
      if (!note) return null;

      return {
        noteId,
        title: note.title,
        category: note.category,
        tags: note.tags,
        similarity: Math.round(similarity * 1000) / 1000,
        relevance: similarity >= 0.7 ? "high" : similarity >= 0.5 ? "medium" : "low",
        snippet: note.content.slice(0, 200) + (note.content.length > 200 ? "..." : ""),
        updatedAt: note.updatedAt,
        clusterId: note.clusterId,
      };
    })
  );

  return c.json({
    query,
    results: results.filter(Boolean),
    total: results.filter(Boolean).length,
  });
});

/**
 * POST /api/gpt/similarity
 * 2つのテキスト間の類似度を計算
 *
 * Body: { text1: string, text2: string }
 * Response: { similarity: number, interpretation: string }
 */
embedRoute.post("/similarity", async (c) => {
  const body = await c.req.json();
  const { text1, text2 } = body;

  if (!text1 || !text2) {
    throw new ValidationError("text1 and text2 are required", "text1", ErrorCodes.VALIDATION_REQUIRED);
  }

  const [embedding1, embedding2] = await Promise.all([
    generateEmbedding(text1),
    generateEmbedding(text2),
  ]);

  const similarity = cosineSimilarity(embedding1, embedding2);
  const rounded = Math.round(similarity * 1000) / 1000;

  let interpretation: string;
  if (similarity >= 0.9) {
    interpretation = "ほぼ同一の内容";
  } else if (similarity >= 0.8) {
    interpretation = "非常に類似";
  } else if (similarity >= 0.7) {
    interpretation = "関連性が高い";
  } else if (similarity >= 0.5) {
    interpretation = "やや関連";
  } else if (similarity >= 0.3) {
    interpretation = "わずかに関連";
  } else {
    interpretation = "関連性が低い";
  }

  return c.json({
    similarity: rounded,
    interpretation,
    semanticDiff: Math.round((1 - similarity) * 1000) / 1000,
  });
});

/**
 * GET /api/gpt/embedding-stats
 * Embedding の統計情報
 */
embedRoute.get("/embedding-stats", async (c) => {
  const allEmbeddings = await getAllEmbeddings();

  return c.json({
    totalEmbeddings: allEmbeddings.length,
    dimensions: allEmbeddings.length > 0 ? allEmbeddings[0].embedding.length : 384,
    model: "Xenova/all-MiniLM-L6-v2",
    isLocal: true,
  });
});
