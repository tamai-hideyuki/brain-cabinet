import { findAllNotes, updateNoteInDB, findNoteById, createNoteInDB, deleteNoteInDB } from "../repositories/notesRepo";
import { saveNoteHistory, getHistoryById } from "./historyService";
import { computeDiff } from "../utils/diff";

/**
 * JSON文字列を配列にパース（安全に）
 */
const parseJsonArray = (jsonStr: string | null): string[] => {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * DBのノートをAPI用にフォーマット（tags/headingsをパース）
 */
const formatNoteForAPI = (note: {
  id: string;
  title: string;
  path: string;
  content: string;
  tags: string | null;
  category: string | null;
  headings: string | null;
  createdAt: number;
  updatedAt: number;
}) => {
  return {
    ...note,
    tags: parseJsonArray(note.tags),
    headings: parseJsonArray(note.headings),
  };
};

export const getAllNotes = async () => {
  const notes = await findAllNotes();
  return notes.map(formatNoteForAPI);
};

export const getNoteById = async (id: string) => {
  const note = await findNoteById(id);
  if (!note) {
    throw new Error("Note not found");
  }
  return formatNoteForAPI(note);
};

export const createNote = async (title: string, content: string) => {
  if (!title || !content) {
    throw new Error("Title and content are required");
  }
  const note = await createNoteInDB(title, content);
  return note ? formatNoteForAPI(note) : null;
};

export const deleteNote = async (id: string) => {
  const deleted = await deleteNoteInDB(id);
  if (!deleted) {
    throw new Error("Note not found");
  }
  return formatNoteForAPI(deleted);
};

export const updateNote = async (id: string, newContent: string) => {
  // ① 元のノートを取得（履歴用に必要）
  const old = await findNoteById(id);

  if (!old) {
    throw new Error("Note not found");
  }

  // 内容が変わっていない場合はスキップ
  if (old.content === newContent) {
    return formatNoteForAPI(old);
  }

  // ② 履歴保存（前の内容 + 差分）
  const diff = computeDiff(old.content, newContent);
  await saveNoteHistory({
    noteId: id,
    content: old.content,
    diff,
  });

  // ③ 本体を更新
  const updated = await updateNoteInDB(id, newContent);
  return updated ? formatNoteForAPI(updated) : null;
};

export const revertNote = async (noteId: string, historyId: string) => {
  // 履歴を取得
  const history = await getHistoryById(historyId);
  if (!history) {
    throw new Error("History not found");
  }

  // noteIdが一致するか確認
  if (history.noteId !== noteId) {
    throw new Error("History does not belong to this note");
  }

  // 履歴のcontentに巻き戻す（現在の内容も履歴として保存）
  return await updateNote(noteId, history.content);
};
