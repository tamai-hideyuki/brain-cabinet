/**
 * GPT向けコンテキスト抽出
 */

import { findNoteById } from "../../repositories/notesRepo";
import { findHistoryByNoteId } from "../../repositories/historyRepo";
import { normalizeMarkdown, formatForGPT, extractOutline, extractBulletPoints } from "../../utils/markdown";
import { normalizeForGPT } from "../../utils/normalize";

// -------------------------------------
// 型定義
// -------------------------------------
export interface GPTContextOptions {
  includeFullContent?: boolean;
  includeHistory?: boolean;
  historyLimit?: number;
  includeOutline?: boolean;
  includeBulletPoints?: boolean;
}

export interface GPTContext {
  note: {
    id: string;
    title: string;
    category: string | null;
    tags: string[];
    headings: string[];
    createdAt: number;
    updatedAt: number;
  };
  content: {
    full?: string;
    outline?: string[];
    bulletPoints?: string[];
    summary: string;
  };
  history?: {
    count: number;
    recent: {
      id: string;
      createdAt: number;
      summary: string;
    }[];
  };
  gptInstruction: string;
}

// -------------------------------------
// コンテキスト抽出
// -------------------------------------
export const getContextForGPT = async (
  noteId: string,
  options: GPTContextOptions = {}
): Promise<GPTContext> => {
  const {
    includeFullContent = true,
    includeHistory = true,
    historyLimit = 3,
    includeOutline = true,
    includeBulletPoints = false,
  } = options;

  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error("Note not found");
  }

  const tags: string[] = note.tags ? JSON.parse(note.tags) : [];
  const headings: string[] = note.headings ? JSON.parse(note.headings) : [];

  const normalizedContent = normalizeMarkdown(note.content);
  const gptFormattedContent = formatForGPT(note.content);
  const summary = normalizeForGPT(note.content).slice(0, 300) + "...";

  const content: GPTContext["content"] = { summary };

  if (includeFullContent) {
    content.full = gptFormattedContent;
  }
  if (includeOutline) {
    content.outline = extractOutline(note.content);
  }
  if (includeBulletPoints) {
    content.bulletPoints = extractBulletPoints(note.content);
  }

  let history: GPTContext["history"];
  if (includeHistory) {
    const allHistories = await findHistoryByNoteId(noteId);
    const recentHistories = allHistories.slice(0, historyLimit);

    history = {
      count: allHistories.length,
      recent: recentHistories.map((h) => ({
        id: h.id,
        createdAt: h.createdAt,
        summary: normalizeForGPT(h.content).slice(0, 100) + "...",
      })),
    };
  }

  const gptInstruction = `
このノートは「${note.title}」というタイトルで、カテゴリは「${note.category || "未分類"}」です。
${tags.length > 0 ? `関連タグ: ${tags.join(", ")}` : "タグなし"}
${headings.length > 0 ? `主な見出し: ${headings.slice(0, 5).join(", ")}` : ""}
${history ? `${history.count}件の編集履歴があります。` : ""}
`.trim();

  return {
    note: {
      id: note.id,
      title: note.title,
      category: note.category,
      tags,
      headings,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
    content,
    history,
    gptInstruction,
  };
};
