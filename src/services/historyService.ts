import { insertHistory, findHistoryByNoteId, findHistoryById } from "../repositories/historyRepo";
import { findNoteById } from "../repositories/notesRepo";
import { computeHtmlDiff } from "../utils/diff";
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

export const getHistoryHtmlDiff = async (historyId: string) => {
  const history = await findHistoryById(historyId);
  if (!history) {
    throw new Error("History not found");
  }

  const note = await findNoteById(history.noteId);
  if (!note) {
    throw new Error("Note not found");
  }

  // 履歴(過去) → 現在 の差分をHTML化
  const html = computeHtmlDiff(history.content, note.content);
  return { historyId, noteId: history.noteId, html };
};

export const getHistoryById = async (historyId: string) => {
  return await findHistoryById(historyId);
};
