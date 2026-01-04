-- ブックマークノードにライブラリ色フィールドを追加
-- ライブラリページでブックマークフォルダの色をカスタマイズするため

ALTER TABLE bookmark_nodes ADD COLUMN library_color TEXT;
