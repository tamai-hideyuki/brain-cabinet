import { insertHistory, findHistoryByNoteId } from "../repositories/historyRepo";
import { randomUUID } from "crypto";

type SaveHistoryInput = {
  noteId: string;
  content: string;
  diff?: string;
};

export const saveNoteHistory = async ({ noteId, content, diff }: SaveHistoryInput) => {
  await insertHistory({
    id: randomUUID(),
    noteId,
    content,
    diff: diff ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });
};

export const getNoteHistory = async (noteId: string) => {
  return await findHistoryByNoteId(noteId);
};
