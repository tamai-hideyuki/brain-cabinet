-- ============================================================
-- v7 Temporal Clustering（時系列クラスタ追跡）
-- ============================================================
-- 設計原則: append-only（修正は新規追加で表現）

-- クラスタリングスナップショット（世代管理）
CREATE TABLE IF NOT EXISTS clustering_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prev_snapshot_id INTEGER,                           -- 比較元スナップショット
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  trigger TEXT NOT NULL,                              -- 'significant_change' | 'scheduled' | 'manual' | 'initial'
  k INTEGER NOT NULL,                                 -- クラスタ数
  total_notes INTEGER NOT NULL,
  avg_cohesion REAL,                                  -- 全体の平均凝集度
  is_current INTEGER NOT NULL DEFAULT 0,              -- 最新かどうか (0/1)

  -- 変化検出用メトリクス
  change_score REAL,                                  -- 前回からの変化度（0〜1）
  notes_added INTEGER NOT NULL DEFAULT 0,
  notes_removed INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY (prev_snapshot_id) REFERENCES clustering_snapshots(id)
);

-- スナップショット内クラスタ
CREATE TABLE IF NOT EXISTS snapshot_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  local_id INTEGER NOT NULL,                          -- 0〜k-1（スナップショット内ID）
  centroid BLOB NOT NULL,                             -- Float32Array
  centroid_norm REAL,                                 -- cosine高速化用
  size INTEGER NOT NULL,
  sample_note_id TEXT,
  cohesion REAL,

  FOREIGN KEY (snapshot_id) REFERENCES clustering_snapshots(id) ON DELETE CASCADE,
  UNIQUE (snapshot_id, local_id)
);

-- クラスタ継承関係（predecessor）
CREATE TABLE IF NOT EXISTS cluster_lineage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,                       -- 新スナップショット
  cluster_id INTEGER NOT NULL,                        -- snapshot_clusters.id
  predecessor_cluster_id INTEGER,                     -- 前スナップショットのsnapshot_clusters.id (NULLなら新規)
  similarity REAL NOT NULL,                           -- predecessorとの類似度
  confidence_score REAL NOT NULL,                     -- 0〜1の数値
  confidence_label TEXT NOT NULL,                     -- 'high' | 'medium' | 'low' | 'none'

  FOREIGN KEY (snapshot_id) REFERENCES clustering_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (cluster_id) REFERENCES snapshot_clusters(id) ON DELETE CASCADE,
  FOREIGN KEY (predecessor_cluster_id) REFERENCES snapshot_clusters(id) ON DELETE SET NULL
);

-- クラスタイベント（分裂/統合/消滅/新規）
CREATE TABLE IF NOT EXISTS cluster_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,                       -- このイベントが発生したスナップショット
  event_type TEXT NOT NULL,                           -- 'split' | 'merge' | 'extinct' | 'emerge' | 'continue'
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),

  -- イベント詳細（JSON）
  -- split:  { source: cluster_id, targets: [cluster_id, ...] }
  -- merge:  { sources: [cluster_id, ...], target: cluster_id }
  -- extinct: { cluster_id: id, last_size: n }
  -- emerge: { cluster_id: id, initial_size: n }
  -- continue: { from: cluster_id, to: cluster_id, similarity: 0.85 }
  details TEXT NOT NULL,

  FOREIGN KEY (snapshot_id) REFERENCES clustering_snapshots(id) ON DELETE CASCADE
);

-- スナップショット内ノート割り当て
CREATE TABLE IF NOT EXISTS snapshot_note_assignments (
  snapshot_id INTEGER NOT NULL,
  note_id TEXT NOT NULL,
  cluster_id INTEGER NOT NULL,                        -- snapshot_clusters.id

  PRIMARY KEY (snapshot_id, note_id),
  FOREIGN KEY (snapshot_id) REFERENCES clustering_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (cluster_id) REFERENCES snapshot_clusters(id) ON DELETE CASCADE
);

-- ============================================================
-- インデックス
-- ============================================================

-- 最新スナップショット検索用
CREATE INDEX IF NOT EXISTS idx_snapshots_current
  ON clustering_snapshots(is_current);

-- 時系列検索用
CREATE INDEX IF NOT EXISTS idx_snapshots_created
  ON clustering_snapshots(created_at);

-- predecessor逆引き用（どのクラスタがこのクラスタから派生したか）
CREATE INDEX IF NOT EXISTS idx_lineage_predecessor
  ON cluster_lineage(predecessor_cluster_id);

-- スナップショット内のlineage検索用
CREATE INDEX IF NOT EXISTS idx_lineage_snapshot
  ON cluster_lineage(snapshot_id);

-- イベントタイプ別検索用
CREATE INDEX IF NOT EXISTS idx_events_type
  ON cluster_events(event_type);

-- スナップショット別イベント検索用
CREATE INDEX IF NOT EXISTS idx_events_snapshot
  ON cluster_events(snapshot_id);

-- ノート別の割り当て履歴検索用
CREATE INDEX IF NOT EXISTS idx_assignments_note
  ON snapshot_note_assignments(note_id);

-- スナップショット別クラスタ検索用
CREATE INDEX IF NOT EXISTS idx_snapshot_clusters_snapshot
  ON snapshot_clusters(snapshot_id);
