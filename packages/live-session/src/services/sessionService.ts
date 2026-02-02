import { db } from "../db/client";
import { sessions, transcriptSegments, suggestions, mindmapNodes } from "../db/schema";
import type { Session, NewSession } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function listSessions(): Promise<Session[]> {
  return db.select().from(sessions).orderBy(desc(sessions.createdAt));
}

export async function getSession(id: string): Promise<Session | undefined> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
  return session;
}

export async function createSession(title: string): Promise<Session> {
  const now = Date.now();
  const session: NewSession = {
    id: uuidv4(),
    title,
    status: "active",
    startedAt: now,
    createdAt: now,
  };
  await db.insert(sessions).values(session);
  return session as Session;
}

export async function updateSessionStatus(
  id: string,
  status: "active" | "paused" | "ended"
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === "ended") {
    updates.endedAt = Date.now();
  }
  await db.update(sessions).set(updates).where(eq(sessions.id, id));
}

export async function updateSessionTitle(id: string, title: string): Promise<void> {
  await db.update(sessions).set({ title }).where(eq(sessions.id, id));
}

export async function updateSessionSummary(id: string, summary: string): Promise<void> {
  await db.update(sessions).set({ summary }).where(eq(sessions.id, id));
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(mindmapNodes).where(eq(mindmapNodes.sessionId, id));
  await db.delete(suggestions).where(eq(suggestions.sessionId, id));
  await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function getSessionTranscripts(sessionId: string) {
  return db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(transcriptSegments.timestamp);
}

export async function getSessionSuggestions(sessionId: string) {
  return db
    .select()
    .from(suggestions)
    .where(eq(suggestions.sessionId, sessionId))
    .orderBy(desc(suggestions.createdAt));
}

export async function getSessionMindmap(sessionId: string) {
  return db
    .select()
    .from(mindmapNodes)
    .where(eq(mindmapNodes.sessionId, sessionId))
    .orderBy(mindmapNodes.createdAt);
}
