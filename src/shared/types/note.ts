import type { notes, noteHistory } from "../db/schema";
import type { InferSelectModel } from "drizzle-orm";

/**
 * DBから取得したノートの型（生データ）
 */
export type NoteRaw = InferSelectModel<typeof notes>;

/**
 * API用にフォーマットされたノートの型
 * tags/headingsがパース済み
 */
export interface Note {
  id: string;
  title: string;
  path: string;
  content: string;
  tags: string[];
  headings: string[];
  category: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * DBから取得したノート履歴の型
 */
export type NoteHistory = InferSelectModel<typeof noteHistory>;

/**
 * 検索結果に必要なノートのフィールド
 * searchService内のスコア計算で使用
 */
export interface NoteForScoring {
  id: string;
  title: string;
  content: string;
  headings: string | null;
  tags: string | null;
  category: string | null;
  updatedAt: number;
}

/**
 * 履歴挿入時のデータ
 */
export interface InsertHistoryData {
  id: string;
  noteId: string;
  content: string;
  diff?: string | null;
  semanticDiff?: string | null;
  prevClusterId?: number | null;
  newClusterId?: number | null;
  changeType?: string | null;        // v5.6: SemanticChangeType
  changeDetail?: string | null;      // v5.6: SemanticChangeDetail (JSON)
  createdAt: number;
}
