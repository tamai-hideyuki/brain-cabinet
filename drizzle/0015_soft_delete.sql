-- ソフトデリート機能の追加
-- 削除したノートを1時間以内なら復元可能にする

-- notes テーブルに deleted_at カラムを追加
-- NULL: 未削除, 値あり: 削除日時（Unix秒）
ALTER TABLE notes ADD COLUMN deleted_at INTEGER;

-- 削除済みノートを効率的に検索するためのインデックス
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
