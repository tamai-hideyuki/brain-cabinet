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

// 軽量版: ノート + 最新N件の履歴（デフォルト3件）
export const getNoteWithHistory = async (noteId: string, limit = 3) => {
  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error("Note not found");
  }

  const allHistories = await findHistoryByNoteId(noteId);
  const recentHistories = allHistories.slice(0, limit);

  return {
    note: {
      id: note.id,
      title: note.title,
      path: note.path,
      content: note.content,
      tags: note.tags ? JSON.parse(note.tags) : [],
      category: note.category,
      headings: note.headings ? JSON.parse(note.headings) : [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    histories: recentHistories.map((h) => ({
      id: h.id,
      createdAt: h.createdAt,
      // 軽量版なのでcontentは含めない（必要ならfull-contextを使う）
      hasContent: true,
    })),
    totalHistories: allHistories.length,
  };
};

// GPT向け: ノート + 全履歴 + 差分を一括取得
export const getNoteFullContext = async (noteId: string) => {
  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error("Note not found");
  }

  const histories = await findHistoryByNoteId(noteId);

  // 各履歴に HTML diff を追加（履歴→現在 の差分）
  const historiesWithDiff = histories.map((h) => ({
    id: h.id,
    content: h.content,
    diff: h.diff,
    createdAt: h.createdAt,
    htmlDiff: computeHtmlDiff(h.content, note.content),
  }));

  return {
    note: {
      id: note.id,
      title: note.title,
      path: note.path,
      content: note.content,
      tags: note.tags ? JSON.parse(note.tags) : [],
      category: note.category,
      headings: note.headings ? JSON.parse(note.headings) : [],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    // 最新 → 過去 の順（createdAt 降順）
    histories: historiesWithDiff,
    totalHistories: historiesWithDiff.length,
  };
};
