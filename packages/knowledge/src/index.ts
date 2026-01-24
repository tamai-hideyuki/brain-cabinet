import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db/client";
import { knowledgeNotes, categories, tags, knowledgeBookmarkNodes } from "./db/schema";
import { eq, desc, isNull, isNotNull, lt, and, count, asc } from "drizzle-orm";
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
  const limit = parseInt(c.req.query("limit") || "30");
  const offset = parseInt(c.req.query("offset") || "0");

  // 総件数を取得
  const totalResult = await db
    .select({ count: count() })
    .from(knowledgeNotes)
    .where(isNull(knowledgeNotes.deletedAt));
  const total = totalResult[0]?.count || 0;

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

  return c.json({ notes: result, total, limit, offset });
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

// 使用中のカテゴリを取得（ノートから抽出）
app.get("/api/categories/used", async (c) => {
  const result = await db
    .select({ category: knowledgeNotes.category })
    .from(knowledgeNotes)
    .where(and(isNull(knowledgeNotes.deletedAt), isNotNull(knowledgeNotes.category)));

  // ユニークなカテゴリのリストを作成
  const uniqueCategories = [...new Set(result.map((r) => r.category).filter(Boolean))] as string[];
  return c.json({ categories: uniqueCategories.sort() });
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

// 使用中のタグを取得（ノートから抽出）
app.get("/api/tags/used", async (c) => {
  const result = await db
    .select({ tags: knowledgeNotes.tags })
    .from(knowledgeNotes)
    .where(and(isNull(knowledgeNotes.deletedAt), isNotNull(knowledgeNotes.tags)));

  // 全ノートのタグを集約してユニークなリストを作成
  const allTags: string[] = [];
  for (const row of result) {
    if (row.tags) {
      try {
        const parsed = JSON.parse(row.tags) as string[];
        allTags.push(...parsed);
      } catch {
        // ignore parse errors
      }
    }
  }
  const uniqueTags = [...new Set(allTags)].sort();
  return c.json({ tags: uniqueTags });
});

// ========== Bookmarks API ==========

// ブックマークツリー構築用のヘルパー関数
type BookmarkNode = {
  id: string;
  parentId: string | null;
  type: string;
  name: string;
  noteId: string | null;
  url: string | null;
  position: number;
  isExpanded: boolean;
  createdAt: number | null;
  updatedAt: number | null;
  note?: {
    id: string;
    title: string;
    category: string | null;
  };
  children?: BookmarkNode[];
};

const buildTree = (nodes: BookmarkNode[], parentId: string | null = null): BookmarkNode[] => {
  return nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.position - b.position)
    .map((node) => ({
      ...node,
      children: buildTree(nodes, node.id),
    }));
};

// ブックマークツリー取得
app.get("/api/bookmarks", async (c) => {
  const result = await db
    .select({
      id: knowledgeBookmarkNodes.id,
      parentId: knowledgeBookmarkNodes.parentId,
      type: knowledgeBookmarkNodes.type,
      name: knowledgeBookmarkNodes.name,
      noteId: knowledgeBookmarkNodes.noteId,
      url: knowledgeBookmarkNodes.url,
      position: knowledgeBookmarkNodes.position,
      isExpanded: knowledgeBookmarkNodes.isExpanded,
      createdAt: knowledgeBookmarkNodes.createdAt,
      updatedAt: knowledgeBookmarkNodes.updatedAt,
      noteTitle: knowledgeNotes.title,
      noteCategory: knowledgeNotes.category,
    })
    .from(knowledgeBookmarkNodes)
    .leftJoin(knowledgeNotes, eq(knowledgeBookmarkNodes.noteId, knowledgeNotes.id))
    .orderBy(asc(knowledgeBookmarkNodes.position));

  const nodes: BookmarkNode[] = result.map((row) => ({
    id: row.id,
    parentId: row.parentId,
    type: row.type,
    name: row.name,
    noteId: row.noteId,
    url: row.url,
    position: row.position,
    isExpanded: row.isExpanded === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    note: row.noteId
      ? {
          id: row.noteId,
          title: row.noteTitle || row.name,
          category: row.noteCategory,
        }
      : undefined,
  }));

  const tree = buildTree(nodes);
  return c.json({ tree, total: nodes.length });
});

// ブックマーク作成
app.post("/api/bookmarks", async (c) => {
  const body = await c.req.json();
  const now = Date.now();
  const id = uuidv4();

  // 同一親内での最大position取得
  const maxPosResult = await db
    .select({ maxPos: knowledgeBookmarkNodes.position })
    .from(knowledgeBookmarkNodes)
    .where(
      body.parentId
        ? eq(knowledgeBookmarkNodes.parentId, body.parentId)
        : isNull(knowledgeBookmarkNodes.parentId)
    )
    .orderBy(desc(knowledgeBookmarkNodes.position))
    .limit(1);

  const position = (maxPosResult[0]?.maxPos ?? -1) + 1;

  await db.insert(knowledgeBookmarkNodes).values({
    id,
    parentId: body.parentId || null,
    type: body.type || "note",
    name: body.name,
    noteId: body.noteId || null,
    url: body.url || null,
    position,
    isExpanded: body.type === "folder" ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  log.info({ bookmarkId: id, type: body.type }, "Bookmark created");
  return c.json({ id, position }, 201);
});

// ブックマーク更新
app.put("/api/bookmarks/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = Date.now();

  const updateData: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.isExpanded !== undefined) updateData.isExpanded = body.isExpanded ? 1 : 0;

  await db
    .update(knowledgeBookmarkNodes)
    .set(updateData)
    .where(eq(knowledgeBookmarkNodes.id, id));

  return c.json({ success: true });
});

// ブックマーク削除（再帰的に子も削除）
const deleteBookmarkRecursive = async (id: string) => {
  // 子ノードを先に削除
  const children = await db
    .select({ id: knowledgeBookmarkNodes.id })
    .from(knowledgeBookmarkNodes)
    .where(eq(knowledgeBookmarkNodes.parentId, id));

  for (const child of children) {
    await deleteBookmarkRecursive(child.id);
  }

  await db.delete(knowledgeBookmarkNodes).where(eq(knowledgeBookmarkNodes.id, id));
};

app.delete("/api/bookmarks/:id", async (c) => {
  const id = c.req.param("id");
  await deleteBookmarkRecursive(id);
  log.info({ bookmarkId: id }, "Bookmark deleted");
  return c.json({ success: true });
});

// ブックマーク移動
app.post("/api/bookmarks/:id/move", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const now = Date.now();

  // 循環参照チェック
  const checkIsDescendant = async (nodeId: string, potentialParentId: string): Promise<boolean> => {
    if (nodeId === potentialParentId) return true;
    const [parent] = await db
      .select({ parentId: knowledgeBookmarkNodes.parentId })
      .from(knowledgeBookmarkNodes)
      .where(eq(knowledgeBookmarkNodes.id, potentialParentId));
    if (!parent || !parent.parentId) return false;
    return checkIsDescendant(nodeId, parent.parentId);
  };

  if (body.newParentId && (await checkIsDescendant(id, body.newParentId))) {
    return c.json({ error: "Cannot move node to its own descendant" }, 400);
  }

  // 新しい位置を計算
  let newPosition = body.newPosition;
  if (newPosition === undefined) {
    const maxPosResult = await db
      .select({ maxPos: knowledgeBookmarkNodes.position })
      .from(knowledgeBookmarkNodes)
      .where(
        body.newParentId
          ? eq(knowledgeBookmarkNodes.parentId, body.newParentId)
          : isNull(knowledgeBookmarkNodes.parentId)
      )
      .orderBy(desc(knowledgeBookmarkNodes.position))
      .limit(1);
    newPosition = (maxPosResult[0]?.maxPos ?? -1) + 1;
  }

  await db
    .update(knowledgeBookmarkNodes)
    .set({
      parentId: body.newParentId || null,
      position: newPosition,
      updatedAt: now,
    })
    .where(eq(knowledgeBookmarkNodes.id, id));

  return c.json({ success: true });
});

// ブックマーク並べ替え
app.post("/api/bookmarks/reorder", async (c) => {
  const body = await c.req.json();
  const now = Date.now();

  // body.items = [{ id, position }]
  for (const item of body.items) {
    await db
      .update(knowledgeBookmarkNodes)
      .set({ position: item.position, updatedAt: now })
      .where(eq(knowledgeBookmarkNodes.id, item.id));
  }

  return c.json({ success: true });
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
