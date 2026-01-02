-- ============================================================
-- v7.1 クラスタアイデンティティ（論理クラスタID）
-- ============================================================
-- 設計思想:
-- - snapshot_clusters.id = 物理ID（一時的、スナップショットごとに変わる）
-- - cluster_identities.id = 論理ID（永続、思考系譜を追跡）

-- クラスタアイデンティティテーブル
CREATE TABLE IF NOT EXISTS cluster_identities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  label TEXT,                                    -- 例: "OAuth理解", "設計判断"
  description TEXT,                              -- 詳細説明
  is_active INTEGER NOT NULL DEFAULT 1,          -- 1: アクティブ, 0: 消滅済み
  last_seen_snapshot_id INTEGER,                 -- 最後に観測されたスナップショット

  FOREIGN KEY (last_seen_snapshot_id) REFERENCES clustering_snapshots(id)
);

-- snapshot_clusters に identity_id カラムを追加
ALTER TABLE snapshot_clusters ADD COLUMN identity_id INTEGER;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_identities_active
  ON cluster_identities(is_active);

CREATE INDEX IF NOT EXISTS idx_identities_last_seen
  ON cluster_identities(last_seen_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_clusters_identity
  ON snapshot_clusters(identity_id);
