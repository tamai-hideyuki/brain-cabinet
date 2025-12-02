-- FTS5 仮想テーブル（スタンドアロン方式）
-- notes テーブルと手動で同期し、title/content/tags/headings を全文検索可能にする
-- note_id を保存して元のノートと紐付け

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content,
  tags,
  headings
);
