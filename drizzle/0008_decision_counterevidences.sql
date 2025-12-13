-- v4.4 反証ログ機能（Counterevidence Log）
-- 判断の「反証」を記録し、失敗を資産化するためのテーブル

CREATE TABLE IF NOT EXISTS decision_counterevidences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_note_id TEXT NOT NULL,           -- 元の判断ノートID
  type TEXT NOT NULL,                       -- regret | missed_alternative | unexpected_outcome | contradiction
  content TEXT NOT NULL,                    -- 反証内容
  source_note_id TEXT,                      -- 反証の元になったノートID（あれば）
  severity_score REAL NOT NULL DEFAULT 0.5, -- 0.0-1.0（計算用）
  severity_label TEXT NOT NULL DEFAULT 'minor', -- minor | major | critical
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- 判断ノートごとの反証を高速に検索
CREATE INDEX IF NOT EXISTS idx_counterevidences_decision_note_id
  ON decision_counterevidences(decision_note_id);

-- 深刻度で絞り込み
CREATE INDEX IF NOT EXISTS idx_counterevidences_severity
  ON decision_counterevidences(severity_label, created_at DESC);

-- タイプ別の分析用
CREATE INDEX IF NOT EXISTS idx_counterevidences_type
  ON decision_counterevidences(type, created_at DESC);
