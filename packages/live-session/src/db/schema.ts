import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * セッション（商談・会議単位）
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull(), // 'active' | 'paused' | 'ended'
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  summary: text("summary"), // 会話後に半自動生成。再生用インデックス（結論ではない）
  createdAt: integer("created_at").notNull(),
});

/**
 * 文字起こしセグメント（事実）
 */
export const transcriptSegments = sqliteTable("transcript_segments", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  text: text("text").notNull(),
  speaker: text("speaker"), // 話者識別（将来用）
  confidence: real("confidence"), // Web Speech APIの信頼度
  timestamp: integer("timestamp").notNull(), // セッション開始からのms
  isFinal: integer("is_final").notNull(), // 1=確定, 0=中間結果
});

/**
 * 提案（素材）— 回答ではない
 *
 * contentに入るもの: 論点 / 数値 / 過去事例要約 / 判断軸(pros/cons)
 * 完成文やトークスクリプトは入れない
 */
export const suggestions = sqliteTable("suggestions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  segmentId: text("segment_id"), // どの発言がこの素材を呼んだか
  knowledgeNoteId: text("knowledge_note_id"), // knowledge APIのノートID
  contentType: text("content_type").notNull(), // 'argument' | 'metric' | 'case_summary' | 'pros_cons'
  content: text("content").notNull(), // 素材テキスト
  score: real("score"), // 関連度スコア
  acknowledgedAt: integer("acknowledged_at"), // 見た/留めた（≠採用した）
  pinnedAt: integer("pinned_at"), // ピン留め
  createdAt: integer("created_at").notNull(),
});

/**
 * マインドマップノード（判断の地図）
 */
export const mindmapNodes = sqliteTable("mindmap_nodes", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  label: text("label").notNull(),
  parentId: text("parent_id"), // NULLならルートノード
  type: text("type").notNull(), // 'topic' | 'question' | 'decision_point' | 'reference'
  segmentId: text("segment_id"), // どの発言からこのノードが生まれたか
  createdAt: integer("created_at").notNull(),
});

/**
 * ノイズパターン（ユーザー登録）
 */
export const noisePatterns = sqliteTable("noise_patterns", {
  id: text("id").primaryKey(),
  pattern: text("pattern").notNull(),
  isRegex: integer("is_regex").default(0), // 1なら正規表現として扱う
  createdAt: integer("created_at").notNull(),
});

// 型エクスポート
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type NewTranscriptSegment = typeof transcriptSegments.$inferInsert;
export type Suggestion = typeof suggestions.$inferSelect;
export type NewSuggestion = typeof suggestions.$inferInsert;
export type MindmapNode = typeof mindmapNodes.$inferSelect;
export type NewMindmapNode = typeof mindmapNodes.$inferInsert;
export type NoisePattern = typeof noisePatterns.$inferSelect;
export type NewNoisePattern = typeof noisePatterns.$inferInsert;
