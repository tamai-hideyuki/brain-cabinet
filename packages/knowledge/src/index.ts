import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db/client";
import { knowledgeNotes, categories, tags } from "./db/schema";
import { eq, desc, isNull, isNotNull, lt, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";
import {
  setupFTS,
  rebuildFTSIndex,
  updateFTSForNote,
  deleteFTSForNote,
  searchKeyword,
  searchSemantic,
  searchHybrid,
  saveNoteEmbedding,
  deleteNoteEmbedding,
  generateAllEmbeddings,
} from "./services/searchService";

const log = pino({ name: "knowledge-api" });
const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "knowledge" }));

// ========== Knowledge Notes API ==========

// ========== 検索 API ==========

// 検索（/api/notes/:id より先に定義する必要がある）
app.get("/api/notes/search", async (c) => {
  const query = c.req.query("q") || "";
  const mode = c.req.query("mode") || "hybrid"; // keyword, semantic, hybrid
  const limit = parseInt(c.req.query("limit") || "20");

  if (!query.trim()) {
    return c.json({ results: [], total: 0 });
  }

  try {
    let results;
    switch (mode) {
      case "keyword":
        results = await searchKeyword(query, limit);
        break;
      case "semantic":
        results = await searchSemantic(query, limit);
        break;
      case "hybrid":
      default:
        results = await searchHybrid(query, limit);
        break;
    }

    return c.json({
      results: results.map((r) => ({
        id: r.note.id,
        title: r.note.title,
        content: r.note.content,
        source: r.note.source,
        category: r.note.category,
        score: r.score,
        snippet: r.snippet,
        matchType: r.matchType,
        updatedAt: r.note.updatedAt,
      })),
      total: results.length,
      mode,
    });
  } catch (err) {
    log.error({ err, query, mode }, "Search failed");
    return c.json({ error: "Search failed", results: [], total: 0 }, 500);
  }
});

// FTSインデックス再構築
app.post("/api/search/rebuild-fts", async (c) => {
  try {
    const count = await rebuildFTSIndex();
    return c.json({ success: true, indexed: count });
  } catch (err) {
    log.error({ err }, "Failed to rebuild FTS index");
    return c.json({ error: "Failed to rebuild FTS index" }, 500);
  }
});

// Embedding一括生成
app.post("/api/search/rebuild-embeddings", async (c) => {
  try {
    const { success, failed } = await generateAllEmbeddings();
    return c.json({ success: true, generated: success, failed });
  } catch (err) {
    log.error({ err }, "Failed to rebuild embeddings");
    return c.json({ error: "Failed to rebuild embeddings" }, 500);
  }
});

// 削除済みノート一覧（/api/notes/:id より先に定義する必要がある）
app.get("/api/notes/deleted", async (c) => {
  const result = await db
    .select()
    .from(knowledgeNotes)
    .where(isNotNull(knowledgeNotes.deletedAt))
    .orderBy(desc(knowledgeNotes.deletedAt));

  return c.json({ notes: result, total: result.length });
});

// 一覧取得
app.get("/api/notes", async (c) => {
  const query = c.req.query("q");
  const category = c.req.query("category");
  const tag = c.req.query("tag");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  let result = await db
    .select()
    .from(knowledgeNotes)
    .where(isNull(knowledgeNotes.deletedAt))  // 削除済みを除外
    .orderBy(desc(knowledgeNotes.updatedAt))
    .limit(limit)
    .offset(offset);

  // フィルタリング（簡易実装）
  if (query) {
    result = result.filter(
      (n) =>
        n.title.includes(query) ||
        n.content.includes(query)
    );
  }
  if (category) {
    result = result.filter((n) => n.category === category);
  }
  if (tag) {
    result = result.filter((n) => {
      const noteTags = n.tags ? JSON.parse(n.tags) : [];
      return noteTags.includes(tag);
    });
  }

  return c.json({ notes: result, total: result.length });
});

// 単一取得
app.get("/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  const [note] = await db
    .select()
    .from(knowledgeNotes)
    .where(eq(knowledgeNotes.id, id));

  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }
  return c.json(note);
});

// 作成
app.post("/api/notes", async (c) => {
  const body = await c.req.json();
  const now = Date.now();
  const id = uuidv4();

  const newNote = {
    id,
    title: body.title || "Untitled",
    content: body.content || "",
    source: body.source || null,
    sourceType: body.sourceType || null,
    sourceUrl: body.sourceUrl || null,
    category: body.category || null,
    tags: body.tags ? JSON.stringify(body.tags) : null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(knowledgeNotes).values(newNote);
  log.info({ noteId: id }, "Knowledge note created");

  // 非同期でEmbedding生成とFTS更新（レスポンスはブロックしない）
  Promise.all([
    saveNoteEmbedding(id),
    updateFTSForNote(id),
  ]).catch((err) => {
    log.error({ err, noteId: id }, "Failed to update search index");
  });

  return c.json(newNote, 201);
});

// 更新
app.put("/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = Date.now();

  await db
    .update(knowledgeNotes)
    .set({
      title: body.title,
      content: body.content,
      source: body.source,
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl,
      category: body.category,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      updatedAt: now,
    })
    .where(eq(knowledgeNotes.id, id));

  log.info({ noteId: id }, "Knowledge note updated");

  // 非同期でEmbedding更新とFTS更新
  Promise.all([
    saveNoteEmbedding(id),
    updateFTSForNote(id),
  ]).catch((err) => {
    log.error({ err, noteId: id }, "Failed to update search index");
  });

  return c.json({ success: true });
});

// ソフトデリート（ゴミ箱へ移動）
app.delete("/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  const now = Date.now();

  const [note] = await db
    .select()
    .from(knowledgeNotes)
    .where(eq(knowledgeNotes.id, id));

  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }

  await db
    .update(knowledgeNotes)
    .set({ deletedAt: now })
    .where(eq(knowledgeNotes.id, id));

  // FTSから削除（検索結果に出ないように）
  deleteFTSForNote(id).catch((err) => {
    log.error({ err, noteId: id }, "Failed to remove from FTS");
  });

  log.info({ noteId: id }, "Knowledge note soft deleted");
  return c.json({ message: "Note deleted (can be restored within 1 hour)", note });
});

// ========== ゴミ箱 API ==========

// ノート復元
app.post("/api/notes/:id/restore", async (c) => {
  const id = c.req.param("id");

  const [note] = await db
    .select()
    .from(knowledgeNotes)
    .where(eq(knowledgeNotes.id, id));

  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }

  if (!note.deletedAt) {
    return c.json({ error: "Note is not deleted" }, 400);
  }

  await db
    .update(knowledgeNotes)
    .set({ deletedAt: null })
    .where(eq(knowledgeNotes.id, id));

  // FTSに再追加
  updateFTSForNote(id).catch((err) => {
    log.error({ err, noteId: id }, "Failed to restore FTS");
  });

  log.info({ noteId: id }, "Knowledge note restored");
  return c.json({ message: "Note restored", note: { ...note, deletedAt: null } });
});

// 完全削除（ハードデリート）
app.delete("/api/notes/:id/permanent", async (c) => {
  const id = c.req.param("id");

  const [note] = await db
    .select()
    .from(knowledgeNotes)
    .where(eq(knowledgeNotes.id, id));

  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }

  await db.delete(knowledgeNotes).where(eq(knowledgeNotes.id, id));

  // Embeddingも削除
  deleteNoteEmbedding(id).catch((err) => {
    log.error({ err, noteId: id }, "Failed to delete embedding");
  });

  log.info({ noteId: id }, "Knowledge note permanently deleted");
  return c.json({ message: "Note permanently deleted" });
});

// ========== Categories API ==========

app.get("/api/categories", async (c) => {
  const result = await db.select().from(categories);
  return c.json(result);
});

app.post("/api/categories", async (c) => {
  const body = await c.req.json();
  const id = uuidv4();
  const now = Date.now();

  await db.insert(categories).values({
    id,
    name: body.name,
    description: body.description || null,
    color: body.color || null,
    sortOrder: body.sortOrder || 0,
    createdAt: now,
  });

  return c.json({ id, name: body.name }, 201);
});

// ========== Tags API ==========

app.get("/api/tags", async (c) => {
  const result = await db.select().from(tags);
  return c.json(result);
});

// ========== 自動削除機能 ==========

const TRASH_RETENTION_MS = 60 * 60 * 1000; // 1時間

const purgeExpiredDeletedNotes = async () => {
  const cutoffTime = Date.now() - TRASH_RETENTION_MS;

  const expiredNotes = await db
    .select({ id: knowledgeNotes.id })
    .from(knowledgeNotes)
    .where(and(isNotNull(knowledgeNotes.deletedAt), lt(knowledgeNotes.deletedAt, cutoffTime)));

  let deletedCount = 0;
  for (const { id } of expiredNotes) {
    await db.delete(knowledgeNotes).where(eq(knowledgeNotes.id, id));
    deletedCount++;
  }

  if (deletedCount > 0) {
    log.info({ deletedCount }, "Purged expired deleted notes");
  }

  return deletedCount;
};

// 定期的にゴミ箱を掃除（5分ごと）
const startCleanupJob = () => {
  // 起動時に即座に実行
  purgeExpiredDeletedNotes().catch((err) => {
    log.error({ err }, "Failed to purge expired notes on startup");
  });

  // 5分ごとに実行
  setInterval(() => {
    purgeExpiredDeletedNotes().catch((err) => {
      log.error({ err }, "Failed to purge expired notes");
    });
  }, 5 * 60 * 1000);
};

// ========== Server ==========

const port = parseInt(process.env.KNOWLEDGE_PORT || "3002");

serve({ fetch: app.fetch, port }, async () => {
  log.info(`Knowledge API server running on http://localhost:${port}`);

  // FTSセットアップ
  await setupFTS();

  startCleanupJob();
});
