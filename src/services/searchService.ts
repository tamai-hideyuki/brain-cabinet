import { searchNotesInDB } from "../repositories/searchRepo";

const makeSnippet = (content: string, query: string, length = 80) => {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return content.slice(0, length) + "...";

  const start = Math.max(0, index - length / 2);
  const end = Math.min(content.length, index + length / 2);

  return content.slice(start, end) + "...";
};

export const searchNotes = async (query: string) => {
  const raw = await searchNotesInDB(query);

  return raw.map((note) => ({
    ...note,
    snippet: makeSnippet(note.content, query),
  }));
};
