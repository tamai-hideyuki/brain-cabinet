import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "./db/client";
import { knowledgeNotes, categories, tags } from "./db/schema";
import { eq, desc, like, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";

const log = pino({ name: "knowledge-api" });
const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "knowledge" }));

// ========== Knowledge Notes API ==========

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
  return c.json({ success: true });
});

// 削除
app.delete("/api/notes/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(knowledgeNotes).where(eq(knowledgeNotes.id, id));
  log.info({ noteId: id }, "Knowledge note deleted");
  return c.json({ success: true });
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

// ========== Server ==========

const port = parseInt(process.env.KNOWLEDGE_PORT || "3002");

serve({ fetch: app.fetch, port }, () => {
  log.info(`Knowledge API server running on http://localhost:${port}`);
});
