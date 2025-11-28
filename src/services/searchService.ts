import { searchNotesInDB } from "../repositories/searchRepo";

export const searchNotes = async (query: string) => {
  return await searchNotesInDB(query);
};
