-- ============================================================
-- v4.3: Promotion Notifications（昇格通知テーブル）
-- ============================================================
-- scratch ノートが decision/learning に昇格可能になった時の通知を管理
-- 自動検出するが、昇格の最終判断は人間が行う

CREATE TABLE IF NOT EXISTS promotion_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_id TEXT NOT NULL,                         -- 対象ノートID
  trigger_type TEXT NOT NULL,                    -- "confidence_rise" | "frequency" | "pattern_match"
  source TEXT NOT NULL,                          -- "realtime" | "batch"
  suggested_type TEXT NOT NULL,                  -- 推奨タイプ: "decision" | "learning"
  reason TEXT NOT NULL,                          -- 昇格を推奨する理由（人間向け）
  confidence REAL NOT NULL,                      -- 検出時の confidence
  reason_detail TEXT,                            -- 詳細情報（JSON）
  status TEXT NOT NULL DEFAULT 'pending',        -- "pending" | "dismissed" | "promoted"
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  resolved_at INTEGER                            -- ユーザーが対応した日時
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_promotion_notifications_note_id
  ON promotion_notifications(note_id);
CREATE INDEX IF NOT EXISTS idx_promotion_notifications_status
  ON promotion_notifications(status);
CREATE INDEX IF NOT EXISTS idx_promotion_notifications_created_at
  ON promotion_notifications(created_at);

-- 同一ノート・トリガータイプ・pending の重複防止用（スパム防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_notifications_pending_unique
  ON promotion_notifications(note_id, trigger_type) WHERE status = 'pending';
