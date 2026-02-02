import { serve } from "@hono/node-server";
import type { Server } from "http";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import pino from "pino";
import { setupWebSocket } from "./ws/sessionSocket";
import {
  listSessions,
  getSession,
  createSession,
  updateSessionStatus,
  updateSessionTitle,
  updateSessionSummary,
  deleteSession,
  getSessionTranscripts,
  getSessionSuggestions,
  getSessionMindmap,
} from "./services/sessionService";
import { acknowledgeSuggestion, pinSuggestion, unpinSuggestion } from "./services/suggestionService";
import { checkWhisperHealth } from "./services/whisperService";

const log = pino({ name: "live-session-api" });
const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "live-session" }));

// ========== Sessions API ==========

app.get("/api/sessions", async (c) => {
  const sessions = await listSessions();
  return c.json({ sessions });
});

app.get("/api/sessions/:id", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json(session);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();
  const session = await createSession(body.title || "新しいセッション");
  return c.json(session, 201);
});

app.patch("/api/sessions/:id/status", async (c) => {
  const body = await c.req.json();
  await updateSessionStatus(c.req.param("id"), body.status);
  return c.json({ success: true });
});

app.patch("/api/sessions/:id/title", async (c) => {
  const body = await c.req.json();
  await updateSessionTitle(c.req.param("id"), body.title);
  return c.json({ success: true });
});

app.delete("/api/sessions/:id", async (c) => {
  await deleteSession(c.req.param("id"));
  return c.json({ success: true });
});

app.patch("/api/sessions/:id/summary", async (c) => {
  const body = await c.req.json();
  await updateSessionSummary(c.req.param("id"), body.summary);
  return c.json({ success: true });
});

// ========== Session Data API ==========

app.get("/api/sessions/:id/transcripts", async (c) => {
  const transcripts = await getSessionTranscripts(c.req.param("id"));
  return c.json({ transcripts });
});

app.get("/api/sessions/:id/suggestions", async (c) => {
  const suggestions = await getSessionSuggestions(c.req.param("id"));
  return c.json({ suggestions });
});

app.get("/api/sessions/:id/mindmap", async (c) => {
  const nodes = await getSessionMindmap(c.req.param("id"));
  return c.json({ nodes });
});

app.get("/api/sessions/:id/refined", async (c) => {
  const transcripts = await getSessionTranscripts(c.req.param("id"));
  const { refineSegments } = await import("./services/refineService");
  const text = refineSegments(
    transcripts
      .filter((s) => s.isFinal === 1)
      .map((s) => ({ text: s.text, timestamp: s.timestamp }))
  );
  return c.json({ text });
});

// ========== Suggestion Actions ==========

app.post("/api/suggestions/:id/acknowledge", async (c) => {
  await acknowledgeSuggestion(c.req.param("id"));
  return c.json({ success: true });
});

app.post("/api/suggestions/:id/pin", async (c) => {
  await pinSuggestion(c.req.param("id"));
  return c.json({ success: true });
});

app.delete("/api/suggestions/:id/pin", async (c) => {
  await unpinSuggestion(c.req.param("id"));
  return c.json({ success: true });
});

// ========== Noise Patterns ==========

app.get("/api/noise-patterns", async (c) => {
  const { listNoisePatterns } = await import("./services/noisePatternService");
  const patterns = await listNoisePatterns();
  return c.json({ patterns });
});

app.post("/api/noise-patterns", async (c) => {
  const body = await c.req.json();
  const { addNoisePattern } = await import("./services/noisePatternService");
  const { reloadUserNoisePatterns } = await import("./services/refineService");
  const pattern = await addNoisePattern(body.pattern, body.isRegex ?? false);
  await reloadUserNoisePatterns();
  return c.json(pattern, 201);
});

app.delete("/api/noise-patterns/:id", async (c) => {
  const { deleteNoisePattern } = await import("./services/noisePatternService");
  const { reloadUserNoisePatterns } = await import("./services/refineService");
  await deleteNoisePattern(c.req.param("id"));
  await reloadUserNoisePatterns();
  return c.json({ success: true });
});

// ========== Whisper Health ==========

app.get("/api/whisper/health", async (c) => {
  const available = await checkWhisperHealth();
  return c.json({ available });
});

// ========== Server ==========

const port = parseInt(process.env.LIVE_SESSION_PORT || "3003");

const server = serve({ fetch: app.fetch, port }, async () => {
  log.info(`Live Session API server running on http://localhost:${port}`);
  // 起動時にユーザー登録ノイズパターンをキャッシュに読み込み
  const { reloadUserNoisePatterns } = await import("./services/refineService");
  await reloadUserNoisePatterns().catch((err) =>
    log.warn({ err }, "Failed to load user noise patterns on startup")
  );
});

// WebSocketをHTTPサーバーに接続
setupWebSocket(server as unknown as Server);
