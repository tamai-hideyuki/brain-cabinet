-- ブックマークノードにライブラリ3D位置フィールドを追加
-- ライブラリページでドラッグして配置した位置を保存するため

ALTER TABLE bookmark_nodes ADD COLUMN library_position TEXT;
