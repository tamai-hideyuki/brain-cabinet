-- 苫米地式コーチングセッション機能

-- コーチングセッションテーブル
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id TEXT PRIMARY KEY,
  current_phase TEXT NOT NULL DEFAULT 'goal_setting',
  status TEXT NOT NULL DEFAULT 'active',
  total_turns INTEGER NOT NULL DEFAULT 0,
  phase_progress TEXT,
  insights TEXT,
  started_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  completed_at INTEGER,
  last_active_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- コーチングメッセージテーブル
CREATE TABLE IF NOT EXISTS coaching_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  phase TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  prompt_type TEXT,
  extracted_insights TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_coaching_messages_session_id ON coaching_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_status ON coaching_sessions(status);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_last_active ON coaching_sessions(last_active_at);
