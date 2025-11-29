import { searchNotesInDB } from "../repositories/searchRepo";

const makeSnippet = (content: string, query: string, length = 80) => {
  const index = content.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return content.slice(0, length) + "...";

  const start = Math.max(0, index - length / 2);
  const end = Math.min(content.length, index + length / 2);

  return content.slice(start, end) + "...";
};

// 🔥 スコア計算ロジック（軽量で強力）
const computeScore = (note: any, query: string): number => {
  const q = query.toLowerCase();
  let score = 0;

  const title = note.title.toLowerCase();
  const content = note.content.toLowerCase();

  // 完全一致
  if (title === q) score += 5;

  // 部分一致
  if (title.includes(q)) score += 3;

  // 出現回数
  const count = content.split(q).length - 1;
  score += count * 2;

  // 更新日時補正（最近ほど高い）
  const age = Math.floor(Date.now() / 1000) - note.updatedAt;
  const recency = Math.max(0, 1 - age / (60 * 60 * 24 * 30));
  score += recency;

  return Number(score.toFixed(2));
};

export const searchNotes = async (query: string) => {
  const raw = await searchNotesInDB(query);

  const results = raw.map((note) => ({
    ...note,
    snippet: makeSnippet(note.content, query),
    score: computeScore(note, query),
  }));

  //scoreの高い順にソート
  return results.sort((a, b) => b.score - a.score);
};
