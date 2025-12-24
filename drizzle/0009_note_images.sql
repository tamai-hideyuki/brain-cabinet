-- ノート画像埋め込み機能
-- ノートに紐づく画像をBLOBとして保存

CREATE TABLE IF NOT EXISTS note_images (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ノートID検索用インデックス
CREATE INDEX IF NOT EXISTS idx_note_images_note_id ON note_images(note_id);
