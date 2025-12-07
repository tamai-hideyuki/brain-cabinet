-- ============================================================
-- v3 Base Migration: Personal Thinking Model Infrastructure
-- ============================================================

-- ① 既存 note_embeddings テーブルへのカラム追加
-- ベクトルの長さ（ノルム）を保存
ALTER TABLE note_embeddings ADD COLUMN vector_norm REAL NULL;

-- 前のバージョンとの意味差分（0.0〜1.0 想定）
ALTER TABLE note_embeddings ADD COLUMN semantic_diff REAL NULL;

-- 現在のクラスタID（clustersテーブルのID）
ALTER TABLE note_embeddings ADD COLUMN cluster_id INTEGER NULL;

-- ② cluster_history テーブル（クラスタ遷移ログ）
-- ノートが「いつ・どのクラスタに属していたか」を記録
CREATE TABLE IF NOT EXISTS cluster_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT NOT NULL,
  cluster_id INTEGER NOT NULL,
  assigned_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- インデックス追加（note_id での検索を高速化）
CREATE INDEX IF NOT EXISTS idx_cluster_history_note_id ON cluster_history(note_id);
CREATE INDEX IF NOT EXISTS idx_cluster_history_assigned_at ON cluster_history(assigned_at);

-- ③ concept_graph_edges テーブル（クラスタ間の影響グラフ）
-- クラスタ同士の「どれくらい似てるか / 影響しあっているか」を保存
CREATE TABLE IF NOT EXISTS concept_graph_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_cluster INTEGER NOT NULL,
  target_cluster INTEGER NOT NULL,
  weight REAL NOT NULL,          -- 0.0〜1.0 くらいのスコア想定
  mutual REAL NOT NULL,          -- 双方向性の強さ（0.0〜1.0）
  last_updated INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ユニーク制約（同じペアは1レコードのみ）
CREATE UNIQUE INDEX IF NOT EXISTS idx_concept_graph_edges_pair
  ON concept_graph_edges(source_cluster, target_cluster);

-- ④ metrics_time_series テーブル（1日ごとの集計指標）
-- 1日単位で「どれくらい思考したか／どのクラスタが強かったか」を保存
CREATE TABLE IF NOT EXISTS metrics_time_series (
  date TEXT PRIMARY KEY,         -- '2025-12-07' みたいな文字列
  note_count INTEGER NOT NULL,   -- その日のノート数
  avg_semantic_diff REAL,        -- その日の平均semantic_diff
  dominant_cluster INTEGER,      -- その日の主クラスタ（最頻）
  entropy REAL,                  -- 思考分散度（クラスタ分布のエントロピー）
  growth_vector BLOB,            -- 後で使う用（今はNULLでもOK）
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ⑤ drift_events テーブル（ドリフト・偏りの検出イベント）
-- 思考の偏り・停滞・過集中などを検出して記録
CREATE TABLE IF NOT EXISTS drift_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  detected_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  severity TEXT NOT NULL,         -- 'low' | 'mid' | 'high'
  type TEXT NOT NULL,             -- 'cluster_bias' | 'drift_drop' | 'over_focus' など
  message TEXT NOT NULL,          -- GPTに返す説明文
  related_cluster INTEGER,        -- 関係するクラスタがあれば
  resolved_at INTEGER             -- 解消された日時（NULLなら未解消）
);

-- インデックス追加（検出日時での検索を高速化）
CREATE INDEX IF NOT EXISTS idx_drift_events_detected_at ON drift_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_drift_events_severity ON drift_events(severity);

-- ⑥ ptm_snapshots テーブル（Personal Thinking Model のスナップショット）
-- 「現在地」を定期的に固めておくテーブル
CREATE TABLE IF NOT EXISTS ptm_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),

  center_of_gravity BLOB,        -- 思考ベクトルの重心（埋め込みの平均など）
  cluster_strengths BLOB,        -- クラスタごとのスコア（JSON or バイナリ）
  influence_map BLOB,            -- クラスタ間影響の行列（JSON or バイナリ）
  imbalance_score REAL,          -- 偏り度（0.0〜1.0くらいイメージ）
  growth_direction BLOB,         -- 直近の成長ベクトル（小さいベクトルでOK）

  summary TEXT                   -- GPTが生成する「今の自分レポート」
);

-- インデックス追加（時系列検索を高速化）
CREATE INDEX IF NOT EXISTS idx_ptm_snapshots_captured_at ON ptm_snapshots(captured_at);
