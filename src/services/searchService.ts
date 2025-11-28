import { searchNotesInDB } from "../repositories/searchRepo";

const createSnippet = (content: string, query: string) => {
  const idx = content.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return content.slice(0, 80) + "...";

  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + query.length + 40);

  return content.slice(start, end) + "...";
};

const highlight = (text: string, query: string) => {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "gi");
  return text.replace(regex, (m) => `<mark>${m}</mark>`);
};

export const searchNotes = async (query: string) => {
  const rows = await searchNotesInDB(query);

  return rows.map((row) => {
    const snippet = createSnippet(row.content, query);
    let score = 0;

    if (row.title.toLowerCase().includes(query.toLowerCase())) score += 3;
    const count = (row.content.match(new RegExp(query, "gi")) || []).length;
    score += count * 2;

    return {
      id: row.id,
      title: row.title,
      snippet,
      score,
      highlightedTitle: highlight(row.title, query),
      highlightedSnippet: highlight(snippet, query),
      updatedAt: row.updatedAt,
    };
  });
};
