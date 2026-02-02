import { db } from "../db/client";
import { transcriptSegments } from "../db/schema";
import type { TranscriptSegment, NewTranscriptSegment } from "../db/schema";
import { v4 as uuidv4 } from "uuid";

export interface TranscriptInput {
  sessionId: string;
  text: string;
  speaker?: string;
  confidence?: number;
  timestamp: number;
  isFinal: boolean;
}

export async function saveSegment(input: TranscriptInput): Promise<TranscriptSegment> {
  const segment: NewTranscriptSegment = {
    id: uuidv4(),
    sessionId: input.sessionId,
    text: input.text,
    speaker: input.speaker ?? null,
    confidence: input.confidence ?? null,
    timestamp: input.timestamp,
    isFinal: input.isFinal ? 1 : 0,
  };
  await db.insert(transcriptSegments).values(segment);
  return segment as TranscriptSegment;
}
