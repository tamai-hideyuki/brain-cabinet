-- ============================================================
-- v5.6 Patch: Add semantic change detail to note_history
-- ============================================================

-- セマンティック変化の詳細情報を記録するためのカラム追加
-- change_type: 変化タイプ (expansion, contraction, pivot, deepening, refinement)
-- change_detail: 変化詳細情報 (JSON)
ALTER TABLE note_history ADD COLUMN change_type TEXT NULL;
ALTER TABLE note_history ADD COLUMN change_detail TEXT NULL;

-- インデックス追加（変化タイプ別分析用）
CREATE INDEX IF NOT EXISTS idx_note_history_change_type
  ON note_history(change_type);

-- 変化タイプ別の集計用複合インデックス
CREATE INDEX IF NOT EXISTS idx_note_history_note_change
  ON note_history(note_id, change_type);
