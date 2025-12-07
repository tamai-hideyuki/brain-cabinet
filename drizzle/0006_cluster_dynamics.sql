-- ============================================================
-- v3: Cluster Dynamics（クラスタ動態テーブル）
-- ============================================================
-- 日次でクラスタの状態をスナップショット保存
-- cohesion: クラスタ内の凝集度
-- interactions: 他クラスタとの距離（JSON）
-- stability_score: 前日からの変化量

CREATE TABLE IF NOT EXISTS cluster_dynamics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                        -- ISO日付 'YYYY-MM-DD'
  cluster_id INTEGER NOT NULL,               -- クラスタID
  centroid BLOB NOT NULL,                    -- クラスタ重心（Float32Array）
  cohesion REAL NOT NULL,                    -- 凝集度（0.0〜1.0）
  note_count INTEGER NOT NULL,               -- クラスタ内ノート数
  interactions TEXT,                         -- 他クラスタとの距離（JSON）
  stability_score REAL,                      -- 前日からの変化量
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_cluster_dynamics_date ON cluster_dynamics(date);
CREATE INDEX IF NOT EXISTS idx_cluster_dynamics_cluster_id ON cluster_dynamics(cluster_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cluster_dynamics_date_cluster
  ON cluster_dynamics(date, cluster_id);
