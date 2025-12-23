# シークレットBOX アーキテクチャ

> v5.3.0 画像・動画保存機能

---

## 概要

シークレットBOXは、Brain Cabinetのノート機能とは**完全に隔離された独立したストレージ機能**です。

### 設計思想

```
┌─────────────────────────────────────────────────────────────┐
│                     Brain Cabinet                            │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   📝 ノート機能      │    │   🔒 シークレットBOX       │ │
│  │                     │    │                             │ │
│  │ - notes             │    │ - secret_box_items          │ │
│  │ - note_history      │    │ - secret_box_folders        │ │
│  │ - embeddings        │    │                             │ │
│  │ - clusters          │    │  ※外部参照なし              │ │
│  │ - bookmarks         │    │  ※AI分析なし                │ │
│  │   ...               │    │  ※シンプルな保存・表示のみ  │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│           ↓                            ↓                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   SQLite (data.db)                     │  │
│  │                  同じDBだが完全独立                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 特徴

| 項目 | 説明 |
|------|------|
| **完全独立** | ノート機能のテーブルと一切の外部キー参照なし |
| **AI分析なし** | Embedding生成やクラスタリング分析を行わない |
| **シンプル** | ファイルの保存・表示・削除のみ |
| **フォルダ構造** | 階層的なフォルダで整理可能 |
| **認証** | 既存のClerk認証のみ（追加認証なし） |
| **サイズ制限** | 1ファイル100MBまで |

---

## データベーススキーマ

### secret_box_items テーブル

```sql
CREATE TABLE secret_box_items (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,            -- 表示名
  original_name TEXT NOT NULL,   -- 元ファイル名
  type TEXT NOT NULL,            -- "image" | "video"
  mime_type TEXT NOT NULL,       -- MIME type
  size INTEGER NOT NULL,         -- バイト数
  data BLOB NOT NULL,            -- バイナリデータ本体
  thumbnail BLOB,                -- サムネイル（動画用）
  folder_id TEXT,                -- 所属フォルダID
  position INTEGER DEFAULT 0,    -- 表示順
  created_at INTEGER,            -- 作成日時
  updated_at INTEGER             -- 更新日時
);
```

### secret_box_folders テーブル

```sql
CREATE TABLE secret_box_folders (
  id TEXT PRIMARY KEY,           -- UUID
  name TEXT NOT NULL,            -- フォルダ名
  parent_id TEXT,                -- 親フォルダID（ルートはnull）
  position INTEGER DEFAULT 0,    -- 表示順
  is_expanded INTEGER DEFAULT 1, -- UI展開状態
  created_at INTEGER,
  updated_at INTEGER
);
```

---

## API エンドポイント

### ベースパス: `/api/secret-box`

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/` | ツリー構造取得（フォルダ＋ルートアイテム） |
| GET | `/items` | アイテム一覧（?folderId=xxx で絞り込み） |
| GET | `/items/:id` | アイテムメタデータ取得 |
| GET | `/items/:id/data` | ファイルデータ取得（Range対応） |
| GET | `/items/:id/thumbnail` | サムネイル取得 |
| POST | `/items` | ファイルアップロード（multipart/form-data） |
| PUT | `/items/:id` | メタデータ更新 |
| DELETE | `/items/:id` | アイテム削除 |
| GET | `/folders` | フォルダ一覧 |
| GET | `/folders/:id` | フォルダ取得 |
| POST | `/folders` | フォルダ作成 |
| PUT | `/folders/:id` | フォルダ更新 |
| DELETE | `/folders/:id` | フォルダ削除（空の場合のみ） |

---

## 動画ストリーミング

Range Headerに対応し、動画のシーク再生が可能です。

```
GET /api/secret-box/items/:id/data
Range: bytes=0-1048575

HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1048575/5242880
Content-Type: video/mp4
```

---

## 対応フォーマット

### 画像
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`

### 動画
- `video/mp4`
- `video/webm`
- `video/quicktime` (.mov)

---

## レイヤー構成

```
ui/src/
├── components/pages/SecretBoxPage/   # メインUI
├── api/secretBoxApi.ts               # APIクライアント
└── types/secretBox.ts                # 型定義

src/
├── routes/secret-box/                # APIルート
│   ├── index.ts                      # ツリー取得
│   ├── items.ts                      # アイテムCRUD
│   └── folders.ts                    # フォルダCRUD
├── services/secretBox/               # ビジネスロジック
│   ├── index.ts                      # エクスポート
│   ├── itemService.ts                # アイテム操作
│   ├── folderService.ts              # フォルダ操作
│   └── treeService.ts                # ツリー構築
├── repositories/secretBoxRepo/       # データアクセス
│   ├── index.ts
│   ├── itemRepo.ts
│   └── folderRepo.ts
└── utils/validation/secretBox.ts     # バリデーション
```

---

## UIの機能

- **ギャラリー表示**: グリッドレイアウトでサムネイル表示
- **ドラッグ&ドロップ**: ファイルを直接ドロップしてアップロード
- **フォルダツリー**: サイドバーで階層構造を管理
- **ビューアモーダル**: クリックで画像・動画を拡大表示
- **動画再生**: ビューア内でストリーミング再生

---

## ノート機能との違い

| 項目 | ノート機能 | シークレットBOX |
|------|-----------|----------------|
| データ形式 | テキスト（Markdown） | バイナリ（画像・動画） |
| AI分析 | Embedding生成、クラスタリング | なし |
| 検索 | FTS5、セマンティック検索 | なし（将来対応可能） |
| 履歴 | 変更履歴保存 | なし |
| レビュー | Spaced Review対応 | なし |
| 関連機能 | ブックマーク、タグ、カテゴリ | フォルダのみ |

---

## セキュリティ

- Clerk認証により、認証済みユーザーのみアクセス可能
- ファイルデータはSQLiteのBLOBとして暗号化なしで保存
- URLを知っていても認証なしではアクセス不可

---

**Brain Cabinet** - Your External Brain for AI
