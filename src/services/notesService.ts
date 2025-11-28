import { findAllNotes } from "../repositories/notesRepo";

export const getAllNotes = async () => {
  return await findAllNotes();
};
