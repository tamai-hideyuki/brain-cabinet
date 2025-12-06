import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// カテゴリ定義
export const CATEGORIES = [
  "技術",
  "心理",
  "健康",
  "仕事",
  "人間関係",
  "学習",
  "アイデア",
  "走り書き",
  "その他",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  path: text("path").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),                    // JSON配列として保存 e.g. '["TypeScript","API"]'
  category: text("category"),            // カテゴリ e.g. "技術"
  headings: text("headings"),            // 見出し一覧（JSON） e.g. '["概要","実装"]'
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

export const noteHistory = sqliteTable("note_history", {
  id: text("id").primaryKey(),                 // UUID
  noteId: text("note_id").notNull(),           // 紐づく元のメモ
  content: text("content").notNull(),          // 変更時点の全文スナップショット
  diff: text("diff"),                           // 差分（任意）
  semanticDiff: text("semantic_diff"),          // 意味的差分スコア（0.0〜1.0）JSON文字列
  createdAt: integer("created_at").notNull(),   // 履歴保存日時
});

// Relation タイプ
export const RELATION_TYPES = [
  "similar",    // 類似ノート（0.85以上）
  "derived",    // 派生ノート（0.92以上）
  "reference",  // 参照（将来用）
  "summary_of", // 要約（将来用）
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const noteRelations = sqliteTable("note_relations", {
  id: text("id").primaryKey(),                          // UUID
  sourceNoteId: text("source_note_id").notNull(),       // 関係元ノート
  targetNoteId: text("target_note_id").notNull(),       // 関係先ノート
  relationType: text("relation_type").notNull(),        // "similar" | "derived" | etc.
  score: text("score").notNull(),                        // 類似度スコア（JSON文字列）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});
