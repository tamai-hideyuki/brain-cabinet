/**
 * RAG (Retrieval-Augmented Generation) ドメイン ディスパッチャー
 *
 * 質問に関連するノートを検索し、GPTが回答生成に使えるコンテキストを返す
 * （方式B: GPT Actions委譲 - LLM呼び出しはGPT側で行う）
 */

import { searchNotesSemantic } from "../search";
import { findNoteById } from "../note";
import {
  validateQuery,
  validateLimit,
} from "../../shared/utils/validation";

type RagContextPayload = {
  question?: string;
  limit?: number;
};

type ContextNote = {
  noteId: string;
  title: string;
  content: string;
  relevance: number;
  category: string | null;
  updatedAt: string;
};

type OmittedNote = {
  noteId: string;
  title: string;
  relevance: number;
};

export const ragDispatcher = {
  /**
   * rag.context - 質問に関連するノートのコンテキストを取得
   *
   * GPTはこのコンテキストを使って回答を生成する
   */
  async context(payload: unknown) {
    const p = payload as RagContextPayload | undefined;
    const question = validateQuery(p?.question, "question");
    const limit = validateLimit(p?.limit, 5);

    // セマンティック検索で関連ノートを取得
    const searchResults = await searchNotesSemantic(question);
    const allResults = searchResults as Array<{ id: string; title: string; score: number }>;

    // 上位limit件の詳細を取得してコンテキスト構築
    const limitedResults = allResults.slice(0, limit);
    const remainingResults = allResults.slice(limit);

    const contextNotes: ContextNote[] = [];
    for (const result of limitedResults) {
      const note = await findNoteById(result.id);
      if (!note) continue;

      contextNotes.push({
        noteId: note.id,
        title: note.title,
        content: note.content,
        relevance: Math.round(result.score * 100) / 100,
        category: note.category,
        updatedAt: new Date(note.updatedAt * 1000).toISOString(),
      });
    }

    // 返さなかったノートのサマリー（タイトルとスコアのみ）
    const omittedNotes: OmittedNote[] = remainingResults.map((r) => ({
      noteId: r.id,
      title: r.title,
      relevance: Math.round(r.score * 100) / 100,
    }));

    return {
      question,
      noteCount: contextNotes.length,
      context: contextNotes,
      omittedCount: omittedNotes.length,
      omittedNotes,
      instruction: "上記のノート内容を参照して、ユーザーの質問に回答してください。回答には参照したノートのタイトルを明記してください。omittedNotesに含まれるノートは本文未取得です。必要であればget_noteツールで個別に取得してください。",
    };
  },
};
