/**
 * Review Repository - マイグレーション
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// ============================================================
// Table Creation (for migration)
// ============================================================

export const createReviewTables = async (): Promise<void> => {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS review_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      easiness_factor REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 1,
      repetition INTEGER NOT NULL DEFAULT 0,
      next_review_at INTEGER NOT NULL,
      last_reviewed_at INTEGER,
      scheduled_by TEXT NOT NULL DEFAULT 'auto',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS recall_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      question_type TEXT NOT NULL,
      question TEXT NOT NULL,
      expected_keywords TEXT,
      source TEXT NOT NULL DEFAULT 'template',
      is_active INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS review_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL,
      schedule_id INTEGER NOT NULL,
      quality INTEGER NOT NULL,
      response_time_ms INTEGER,
      questions_attempted INTEGER,
      questions_correct INTEGER,
      easiness_factor_before REAL,
      easiness_factor_after REAL,
      interval_before INTEGER,
      interval_after INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  // インデックス作成
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedules_note_id
    ON review_schedules(note_id)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_review_schedules_next_review
    ON review_schedules(next_review_at) WHERE is_active = 1
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_recall_questions_note_id
    ON recall_questions(note_id)
  `);

  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_review_sessions_note_id
    ON review_sessions(note_id)
  `);
};
