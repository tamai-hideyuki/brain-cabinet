# Brain Knowledge - 使い方ガイド

Brain Knowledge は、読書や業務から学んだ知識を記録・検索するためのナレッジベースです。Brain Cabinet（判断の記録）とは別に、純粋な「知識」を蓄積するために設計されています。

## 目次

1. [初期セットアップ](#初期セットアップ)
2. [基本的な使い方](#基本的な使い方)
3. [検索機能](#検索機能)
4. [ノート間リンク](#ノート間リンク)
5. [ゴミ箱機能](#ゴミ箱機能)
6. [API リファレンス](#api-リファレンス)

---

## 初期セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. データベースのマイグレーション

```bash
cd packages/knowledge
pnpm migrate
```

これにより以下のテーブルが作成されます：
- `knowledge_notes` - 知識ノート
- `knowledge_embeddings` - ベクトル検索用のEmbedding
- `categories` - カテゴリマスタ
- `tags` - タグマスタ

### 3. 開発サーバーの起動

プロジェクトルートから：

```bash
pnpm dev
```

以下のサーバーが起動します：
- **Cabinet API**: http://localhost:3000
- **Knowledge API**: http://localhost:3002
- **Cabinet UI**: http://localhost:5173
- **Knowledge UI**: http://localhost:5174

### 4. 検索インデックスの構築（既存データがある場合）

既存のノートがある場合は、検索インデックスを構築する必要があります：

```bash
# FTS5インデックスの構築
curl -X POST http://localhost:3002/api/search/rebuild-fts

# Embedding（ベクトル検索用）の生成
curl -X POST http://localhost:3002/api/search/rebuild-embeddings
```

> **Note**: 新規ノートは作成・更新時に自動でインデックスされるため、この操作は初回のみ必要です。

---

## 基本的な使い方

### アクセス方法

- **開発時**: http://localhost:5174/
- **本番時**: http://localhost:3000/knowledge/

### ノートの作成

1. ヘッダー右上の「+ 新規作成」ボタンをクリック
2. 以下の情報を入力：
   - **タイトル** (必須): 学んだことの要約
   - **内容** (必須): 詳細な知識の記録
   - **ソース種別**: 書籍、業務、記事、講座・研修、その他
   - **ソース名**: 書籍名やプロジェクト名など
   - **カテゴリ**: 技術、ビジネス、思考法など自由に設定
   - **タグ**: カンマ区切りで複数指定可能

### ノートの編集

1. ノートカードをクリックして詳細画面を開く
2. 右上の「編集」ボタンをクリック

### ノートの削除

1. ノートカードにホバーして「×」ボタンをクリック
2. または詳細画面の「削除」ボタンをクリック
3. 削除されたノートはゴミ箱に移動（1時間後に自動削除）

---

## 検索機能

Brain Knowledge は3つの検索モードをサポートしています：

### Hybrid検索（デフォルト・推奨）

キーワード検索とセマンティック検索を組み合わせた最も精度の高い検索です。

- **キーワード検索 (60%)**: FTS5によるTF-IDFスコアリング
- **セマンティック検索 (40%)**: MiniLM-L6-v2によるベクトル類似度

### 使い方

1. ヘッダーの検索ボックスにキーワードを入力
2. Enterキーを押して検索実行
3. 検索結果にはスコア（マッチ度）が表示されます

### スコアリングの仕組み

キーワード検索では以下の要素がスコアに影響します：

| 要素 | 重み | 説明 |
|------|------|------|
| タイトル一致 | 3x | タイトルに含まれるキーワード |
| コンテンツ一致 | 1x | 本文に含まれるキーワード |
| 新しさ | ボーナス | 7日以内: +3, 30日以内: +1 |

### 検索のクリア

- 検索ボックスの「×」ボタン
- Escキー
- 「検索をクリア」ボタン

---

## ノート間リンク

ノート間で関連付けを作成できます。

### リンクの作成

1. リンク元のノートの詳細画面を開く
2. ノートIDの横の「コピー」ボタンをクリック
3. リンク先のノートの編集画面で、内容に貼り付け

リンク形式：
```
[表示テキスト](ノートID)
```

例：
```
この概念は[デザインパターン](a1b2c3d4-e5f6-7890-abcd-ef1234567890)と関連している。
```

### リンクの表示

詳細画面では、リンクはクリック可能なテキストとして表示されます。クリックするとリンク先のノートに遷移します。

---

## ゴミ箱機能

削除したノートは即座に消えず、ゴミ箱に移動します。

### 仕様

- 削除されたノートは**1時間後に自動で完全削除**されます
- ゴミ箱から復元可能
- 完全削除も可能（取り消し不可）

### 操作

1. ヘッダーの「🗑」ボタンをクリックしてゴミ箱を開く
2. **復元**: 「復元」ボタンをクリック
3. **完全削除**: 「完全削除」ボタンをクリック（確認ダイアログあり）

---

## API リファレンス

### ノート操作

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/api/notes` | ノート一覧取得 |
| GET | `/api/notes/:id` | ノート詳細取得 |
| POST | `/api/notes` | ノート作成 |
| PUT | `/api/notes/:id` | ノート更新 |
| DELETE | `/api/notes/:id` | ノート削除（ゴミ箱へ） |

### ゴミ箱操作

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/api/notes/deleted` | 削除済みノート一覧 |
| POST | `/api/notes/:id/restore` | ノート復元 |
| DELETE | `/api/notes/:id/permanent` | 完全削除 |

### 検索

| メソッド | エンドポイント | 説明 |
|----------|----------------|------|
| GET | `/api/notes/search?q=...&mode=hybrid` | 検索 |
| POST | `/api/search/rebuild-fts` | FTSインデックス再構築 |
| POST | `/api/search/rebuild-embeddings` | Embedding再生成 |

### 検索パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|------------|------|------------|------|
| `q` | Yes | - | 検索クエリ |
| `mode` | No | `hybrid` | `keyword`, `semantic`, `hybrid` |
| `limit` | No | `20` | 結果の最大件数 |

### リクエスト例

```bash
# ノート作成
curl -X POST http://localhost:3002/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "デザインパターンの基礎",
    "content": "GoFのデザインパターンは23種類ある...",
    "sourceType": "book",
    "source": "Head First デザインパターン",
    "category": "技術",
    "tags": ["設計", "オブジェクト指向"]
  }'

# 検索
curl "http://localhost:3002/api/notes/search?q=デザインパターン&mode=hybrid"
```

---

## アーキテクチャ

```
packages/knowledge/
├── src/
│   ├── index.ts              # APIサーバー (Hono)
│   ├── db/
│   │   ├── client.ts         # DB接続
│   │   └── schema.ts         # Drizzle スキーマ
│   └── services/
│       └── searchService.ts  # 検索サービス (FTS5 + Embedding)
├── ui/
│   └── src/
│       ├── App.tsx           # React UI
│       └── App.css           # スタイル
└── data/
    └── knowledge.db          # SQLiteデータベース
```

### 技術スタック

- **バックエンド**: Hono (Node.js)
- **データベース**: SQLite (libsql) + Drizzle ORM
- **全文検索**: SQLite FTS5
- **ベクトル検索**: Xenova/transformers.js (MiniLM-L6-v2)
- **フロントエンド**: React + Vite

---

## トラブルシューティング

### 検索結果が出ない

1. FTSインデックスを再構築：
   ```bash
   curl -X POST http://localhost:3002/api/search/rebuild-fts
   ```

2. Embeddingを再生成：
   ```bash
   curl -X POST http://localhost:3002/api/search/rebuild-embeddings
   ```

### セマンティック検索が遅い

初回のセマンティック検索は、MiniLMモデルのロードに数秒かかる場合があります。2回目以降は高速です。

### ポート競合

デフォルトポート：
- Cabinet API: 3000
- Knowledge API: 3002
- Cabinet UI: 5173
- Knowledge UI: 5174

環境変数で変更可能：
```bash
KNOWLEDGE_PORT=3003 pnpm dev
```
