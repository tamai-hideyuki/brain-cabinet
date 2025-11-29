import { findAllNotes, updateNoteInDB, findNoteById } from "../repositories/notesRepo";
import { saveNoteHistory } from "./historyService";

export const getAllNotes = async () => {
  return await findAllNotes();
};


export const updateNote = async (id: string, newContent: string) => {
  // ① 元のノートを取得（履歴用に必要）
  const old = await findNoteById(id);

  if (!old) {
    throw new Error("Note not found");
  }

  // ② 履歴保存（前の内容をスナップショットとして残す）
  await saveNoteHistory({
    noteId: id,
    content: old.content,
  });

  // ③ 本体を更新
  return await updateNoteInDB(id, newContent);
};
