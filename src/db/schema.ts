import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  path: text("path").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

export const noteHistory = sqliteTable("note_history", {
  id: text("id").primaryKey(),                 // UUID
  noteId: text("note_id").notNull(),           // 紐づく元のメモ
  content: text("content").notNull(),          // 変更時点の全文スナップショット
  diff: text("diff"),                           // 差分（任意）
  createdAt: integer("created_at").notNull(),   // 履歴保存日時
});
