-- ============================================================
-- v3: Note Influence Edges（ノート間の影響グラフ）
-- ============================================================
-- Concept Influence Graph の C モデル（Drift 連動）用
-- influence(A → B) = cosine(A, B) × drift_score(B)

CREATE TABLE IF NOT EXISTS note_influence_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_note_id TEXT NOT NULL,         -- 影響元のノート
  target_note_id TEXT NOT NULL,         -- 影響先のノート（ドリフトしたノート）
  weight REAL NOT NULL,                 -- 影響の強さ (0.0〜1.0)
  cosine_sim REAL NOT NULL,             -- コサイン類似度
  drift_score REAL NOT NULL,            -- ドリフトスコア
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_note_influence_edges_source ON note_influence_edges(source_note_id);
CREATE INDEX IF NOT EXISTS idx_note_influence_edges_target ON note_influence_edges(target_note_id);
CREATE INDEX IF NOT EXISTS idx_note_influence_edges_weight ON note_influence_edges(weight DESC);

-- ユニーク制約（同じペアは1レコードのみ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_note_influence_edges_pair
  ON note_influence_edges(source_note_id, target_note_id);
