/**
 * RAG (Retrieval-Augmented Generation) ドメイン ディスパッチャー
 *
 * 質問に関連するノートを検索し、GPTが回答生成に使えるコンテキストを返す
 * （方式B: GPT Actions委譲 - LLM呼び出しはGPT側で行う）
 */

import * as searchService from "../../services/searchService";
import { findNoteById } from "../../repositories/notesRepo";
import {
  validateQuery,
  validateLimit,
} from "../../utils/validation";

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
    const searchResults = await searchService.searchNotesSemantic(question);

    // 各ノートの詳細を取得してコンテキスト構築（limitで制限）
    const contextNotes: ContextNote[] = [];
    const limitedResults = (searchResults as Array<{ id: string; score: number }>).slice(0, limit);

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

    return {
      question,
      noteCount: contextNotes.length,
      context: contextNotes,
      instruction: "上記のノート内容を参照して、ユーザーの質問に回答してください。回答には参照したノートのタイトルを明記してください。",
    };
  },
};
