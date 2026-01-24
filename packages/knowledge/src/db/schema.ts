import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * 知識ノート
 * 読書や業務から学んだ内容を記録
 */
export const knowledgeNotes = sqliteTable("knowledge_notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  // ソース情報
  source: text("source"),                    // 書籍名、プロジェクト名など
  sourceType: text("source_type"),           // book, work, article, course, other
  sourceUrl: text("source_url"),             // 参照URL（あれば）
  
  // 分類
  category: text("category"),                // 技術, ビジネス, 思考法, etc.
  tags: text("tags"),                        // JSON配列 ["tag1", "tag2"]
  
  // メタデータ
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),  // ソフトデリート用: 削除日時（NULLなら未削除）
});

/**
 * カテゴリマスタ
 */
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),                      // UI表示用のカラーコード
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at").notNull(),
});

/**
 * タグマスタ
 */
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  usageCount: integer("usage_count").default(0),
  createdAt: integer("created_at").notNull(),
});

/**
 * Embedding（ベクトル検索用）
 */
export const knowledgeEmbeddings = sqliteTable("knowledge_embeddings", {
  noteId: text("note_id").primaryKey(),
  embedding: text("embedding").notNull(), // JSON配列として保存
  model: text("model").notNull(),
  version: integer("version").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// 型エクスポート
export type KnowledgeNote = typeof knowledgeNotes.$inferSelect;
export type NewKnowledgeNote = typeof knowledgeNotes.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type KnowledgeEmbedding = typeof knowledgeEmbeddings.$inferSelect;
