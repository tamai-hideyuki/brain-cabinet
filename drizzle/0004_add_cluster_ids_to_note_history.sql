-- ============================================================
-- v3 Patch: Add cluster tracking to note_history
-- ============================================================

-- クラスタ遷移を履歴に記録するためのカラム追加
ALTER TABLE note_history ADD COLUMN prev_cluster_id INTEGER NULL;
ALTER TABLE note_history ADD COLUMN new_cluster_id INTEGER NULL;

-- インデックス追加（クラスタ遷移分析用）
CREATE INDEX IF NOT EXISTS idx_note_history_cluster_change
  ON note_history(prev_cluster_id, new_cluster_id);
