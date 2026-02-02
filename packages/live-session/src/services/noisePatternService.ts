import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { noisePatterns } from "../db/schema";
import type { NoisePattern } from "../db/schema";

export async function listNoisePatterns(): Promise<NoisePattern[]> {
  return db.select().from(noisePatterns).all();
}

export async function addNoisePattern(
  pattern: string,
  isRegex: boolean
): Promise<NoisePattern> {
  const row = {
    id: randomUUID(),
    pattern,
    isRegex: isRegex ? 1 : 0,
    createdAt: Date.now(),
  };
  await db.insert(noisePatterns).values(row);
  return { ...row, isRegex: row.isRegex };
}

export async function deleteNoisePattern(id: string): Promise<void> {
  await db.delete(noisePatterns).where(eq(noisePatterns.id, id));
}
