-- Embedding（ベクトル）テーブル
-- 各ノートの意味ベクトルを保存し、類似度検索を可能にする

CREATE TABLE IF NOT EXISTS note_embeddings (
  note_id TEXT PRIMARY KEY,
  embedding BLOB NOT NULL,
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  dimensions INTEGER NOT NULL DEFAULT 1536,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
