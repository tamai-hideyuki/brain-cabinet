# Brain Cabinet v1.1

**思考ベースの検索型知識システム — あなたの思考を理解し、必要な知識を再構成して返す外部脳**

> Brain Cabinet は単なるメモ帳ではありません。
> ノートの**文脈を理解**し、質問に応じて**必要な部分だけを抽出・再構成**する仕組みです。

---

## なぜ Brain Cabinet なのか？

従来のメモアプリは「保存」と「検索」だけ。Brain Cabinet は違います：

| 従来のメモアプリ | Brain Cabinet |
|----------------|---------------|
| キーワード一致で検索 | **意味を理解**して関連ノートを発見 |
| タグは手動で付ける | **自動でタグ・カテゴリを抽出** |
| 検索結果は羅列 | **TF-IDF + 構造スコア**で最適順に |
| 履歴なし | **差分保存**で思考の変遷を追跡 |
| 単体で完結 | **GPT/Claude と連携**して外部脳化 |

---

## 主な特徴

### 1. 三層検索システム

```
┌─────────────────────────────────────────────────────────────┐
│                       検索クエリ                             │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  キーワード   │     │ セマンティック │     │ ハイブリッド  │
   │    検索      │     │    検索      │     │    検索      │
   │             │     │             │     │             │
   │ FTS5+TF-IDF │     │  Embedding  │     │  両方を統合   │
   │  正確一致    │     │  Cosine類似  │     │  60% + 40%  │
   └─────────────┘     └─────────────┘     └─────────────┘
```

- **キーワード検索**: FTS5 全文検索 + TF-IDF スコアリング
- **セマンティック検索**: OpenAI Embedding による意味ベースの類似度計算
- **ハイブリッド検索**: キーワード(60%) + 意味(40%) を統合した最適解

### 2. 自動メタデータ抽出

ノートを保存すると、以下が**自動で抽出**されます：

- **タグ**: TinySegmenter で形態素解析 → 技術用語にボーナス → 上位10個を選出
- **カテゴリ**: キーワードマッチングで自動分類（技術/心理/健康/仕事/学習など）
- **見出し**: Markdown の `#` から自動抽出

### 3. 文脈理解と履歴管理

- ノート更新時に**差分を自動保存**
- 過去の任意の時点に**巻き戻し可能**
- GPT が**思考の変遷**を参照して回答できる

### 4. GPT/Claude 統合（外部脳化）

GPT は Brain Cabinet API を通じて：
- 関連ノートを**自動検索**
- **文脈を理解**した回答を生成
- 過去のノートを**引用**しながら応答
- 新しいアイデアと**既存知識を結合**

---

## クイックスタート

### 1. インストール

```bash
git clone https://github.com/your-username/brain-cabinet.git
cd brain-cabinet
pnpm install
```

### 2. 環境変数の設定

```bash
# .env ファイルを作成
OPENAI_API_KEY=your-api-key  # セマンティック検索に必要
```

### 3. データベース初期化

```bash
pnpm migrate
```

### 4. ノートのインポート

```bash
pnpm import-notes -- --dir /path/to/your/notes
```

### 5. インデックス構築

```bash
pnpm init-fts          # FTS5 全文検索インデックス
pnpm init-embeddings   # Embedding 生成（セマンティック検索用）
```

### 6. サーバー起動

```bash
pnpm dev
# → http://localhost:3000
```

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                      GPT / Claude                           │
│                  （外部脳として利用）                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Brain Cabinet API                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  /notes  │  │ /search  │  │  /gpt    │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│        │            │             │                         │
│        ▼            ▼             ▼                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Service Layer                       │   │
│  │  notesService │ searchService │ embeddingService     │   │
│  │               │ gptService                           │   │
│  └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Repository Layer                     │   │
│  │  notesRepo │ historyRepo │ searchRepo │ ftsRepo      │   │
│  │  embeddingRepo                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 SQLite (libsql)                      │   │
│  │  notes │ note_history │ notes_fts │ note_embeddings  │   │
│  │                       (FTS5)      (1536次元ベクトル)   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## API リファレンス

### ノート操作

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/notes` | ノート一覧取得 |
| GET | `/api/notes/:id` | ノート詳細取得 |
| POST | `/api/notes` | ノート作成（メタデータ自動抽出） |
| PUT | `/api/notes/:id` | ノート更新（履歴自動保存） |
| DELETE | `/api/notes/:id` | ノート削除 |

### 履歴操作

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/notes/:id/history` | 履歴一覧取得 |
| GET | `/api/notes/:id/history/:historyId/diff` | HTML差分取得 |
| POST | `/api/notes/:id/revert/:historyId` | 巻き戻し |
| GET | `/api/notes/:id/with-history` | ノート + 最新N件履歴 |
| GET | `/api/notes/:id/full-context` | フルコンテキスト |

### 検索（三層システム）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/search?query=keyword` | キーワード検索（FTS5 + TF-IDF） |
| GET | `/api/search?query=keyword&mode=semantic` | セマンティック検索（Embedding） |
| GET | `/api/search?query=keyword&mode=hybrid` | ハイブリッド検索（推奨） |
| GET | `/api/search?query=keyword&category=技術` | カテゴリフィルター |
| GET | `/api/search?query=keyword&tags=typescript` | タグフィルター |
| GET | `/api/search/categories` | カテゴリ一覧 |

### GPT統合 API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/gpt/search` | 複合検索（関連度 high/medium/low 付き） |
| GET | `/api/gpt/notes/:id/context` | コンテキスト抽出（アウトライン・箇条書き・履歴） |
| POST | `/api/gpt/task` | タスク準備（要約・抽出・比較など） |
| GET | `/api/gpt/overview` | 統計情報（ノート数・カテゴリ分布・タグクラウド） |
| GET | `/api/gpt/tasks` | タスクタイプ一覧 |
| GET | `/api/gpt/health` | ヘルスチェック（DB接続・ストレージ状態） |

---

## 検索スコアリングの仕組み

### キーワード検索のスコア構成

| 要素 | 重み | 説明 |
|------|------|------|
| **TF-IDF** | ×2.0 | 統計的重要度（形態素解析済み） |
| **構造スコア** | ×1.5 | タイトル完全一致(+5), 部分一致(+3), 見出し一致 |
| **新規性** | ×0.5 | 7日以内(+1.0), 30日以内(+0.5), 90日以内(+0.2) |
| **長さ補正** | ×0.3 | 短すぎる文書へのペナルティ |
| **メタデータ** | ×1.0 | カテゴリ・タグ一致ボーナス |

### セマンティック検索

- **モデル**: OpenAI text-embedding-3-small
- **次元数**: 1536
- **類似度**: Cosine 類似度（0〜1）

### ハイブリッド検索

```
最終スコア = キーワードスコア × 0.6 + セマンティックスコア × 0.4
```

---

## GPT連携

### OpenAI GPTs / Actions での利用

1. **Tools定義をインポート**
   - `brain-cabinet-tools.json` を OpenAI の Actions 設定にアップロード

2. **System Prompt を設定**
   - `brain-cabinet-mode.md` の内容を System Instructions に追加

3. **サーバーを公開**
   - ngrok や Cloudflare Tunnel でローカルサーバーを公開
   - または VPS にデプロイ

### 利用例

```
ユーザー: TypeScriptについて教えて

GPT: [search_notes API を呼び出し]
     Brain Cabinet に5件の関連ノートがありました。

     最も関連度の高いノート「TypeScript入門」によると...
     （以前書いた「型システムの考え方」ノートとも関連しています）

     ---
     📚 参照ノート:
     - TypeScript入門 (ID: abc123) - 関連度: 高
     - 型システムの考え方 (ID: def456) - 関連度: 中
```

---

## タスクタイプ

GPT が実行できる定型タスク:

| タイプ | 説明 | 必須パラメータ |
|--------|------|---------------|
| `extract_key_points` | ノートから要点を抽出 | noteId |
| `summarize` | ノートを要約 | noteId |
| `generate_ideas` | アイデア生成（関連ノート参照） | noteId |
| `find_related` | 関連ノート検索 | query or noteId |
| `compare_versions` | 履歴比較分析 | noteId |
| `create_outline` | アウトライン作成/改善 | noteId |

---

## カテゴリ（自動分類）

| カテゴリ | キーワード例 |
|---------|-------------|
| 技術 | プログラミング, API, アーキテクチャ, TypeScript |
| 心理 | 心理, 感情, メンタル, ストレス |
| 健康 | 健康, 運動, 睡眠, 栄養 |
| 仕事 | 仕事, プロジェクト, ミーティング, キャリア |
| 習慣 | 習慣, ルーティン, 目標, 継続 |
| 学習 | 学習, 勉強, 読書, スキル |
| 創作 | 創作, アイデア, デザイン, 文章 |
| アイデア | 思いつき, 発想, コンセプト |
| 日記 | 日記, 振り返り, 気づき |
| その他 | 上記に該当しない |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Web Framework | Hono |
| Server | @hono/node-server |
| Database | SQLite (libsql) |
| ORM | Drizzle ORM |
| 全文検索 | SQLite FTS5 |
| Embedding | OpenAI text-embedding-3-small (1536次元) |
| 形態素解析 | TinySegmenter |
| 差分計算 | diff-match-patch |
| ロギング | Pino + pino-pretty |
| 言語 | TypeScript |
| パッケージマネージャ | pnpm |

---

## 開発コマンド

```bash
# 開発サーバー起動
pnpm dev

# DB マイグレーション適用
pnpm migrate

# ノートインポート（Markdown ファイル一括取込）
pnpm import-notes -- --dir /path/to/notes

# ノートエクスポート（DB → Markdown）
pnpm export-notes -- --output /path/to/output

# 差分同期（Markdown ↔ DB）
pnpm sync-notes -- --dir /path/to/notes

# 整合性チェック
pnpm integrity-check -- --dir /path/to/notes

# FTS5 インデックス初期化
pnpm init-fts

# Embedding 一括生成（要 OPENAI_API_KEY）
pnpm init-embeddings
```

---

## ディレクトリ構成

```
brain-cabinet/
├── src/
│   ├── index.ts                  # エントリーポイント
│   ├── db/                       # データベース接続・スキーマ
│   ├── routes/                   # HTTP ルーティング
│   │   ├── notes/                # ノート操作 API
│   │   ├── search/               # 検索 API
│   │   └── gpt/                  # GPT統合 API
│   ├── services/                 # ビジネスロジック
│   │   ├── searchService.ts      # TF-IDF + 構造スコア
│   │   ├── embeddingService.ts   # Embedding 生成・類似度計算
│   │   └── gptService.ts         # GPT向けデータ整形
│   ├── repositories/             # データアクセス層
│   ├── utils/                    # ユーティリティ
│   │   └── metadata.ts           # 自動メタデータ抽出
│   ├── importer/                 # Markdown インポーター
│   ├── exporter/                 # エクスポーター
│   ├── syncer/                   # 差分同期
│   └── checker/                  # 整合性チェック
├── docs/                         # ドキュメント
├── drizzle/                      # マイグレーションファイル
├── openapi.json                  # OpenAPI 仕様書
├── brain-cabinet-mode.md         # GPT 人格設定
└── brain-cabinet-tools.json      # OpenAI Actions 定義
```

---

## ロードマップ

### Phase 1（完了）
- [x] ノート CRUD
- [x] 差分保存・履歴管理
- [x] TF-IDF 検索
- [x] メタデータ自動抽出
- [x] GPT 統合 API

### Phase 2（完了）
- [x] セマンティック検索（Embedding + Cosine類似度）
- [x] ハイブリッド検索（キーワード + 意味検索）
- [x] FTS5 全文検索インデックス
- [x] エクスポート機能（DB → Markdown）
- [x] 整合性チェック機能
- [x] 差分同期機能
- [x] 構造化ロギング（Pino）

### Phase 3（予定）
- [ ] 関連ノート推薦
- [ ] タグ・カテゴリ統計 API
- [ ] 要約生成・保存
- [ ] RAG（質問応答）
- [ ] ノート間リンク分析

### Phase 4（将来）
- [ ] Webhook / 自動インポート
- [ ] マルチユーザー対応
- [ ] Web UI

---

## バージョン履歴

### v1.1.0 (Phase 2 完了)
- セマンティック検索（OpenAI Embedding）
- ハイブリッド検索（キーワード + 意味検索）
- FTS5 全文検索インデックス
- エクスポート機能（DB → Markdown）
- 整合性チェック機能
- 差分同期機能
- 構造化ロギング（Pino + pino-pretty）
- ルートファイル分割によるコード整理

### v1.0.0 (Phase 1 完了)
- ノート管理の基本機能
- TF-IDF + 構造スコア検索
- 履歴管理（差分保存、巻き戻し）
- メタデータ自動抽出
- GPT 統合 API（検索、コンテキスト、タスク）
- Markdown 正規化
- ドキュメント整備

---

> **Note**: このファイルが正式なドキュメントです。`docs/` 配下のファイルはバージョン別スナップショットや補助資料です。

**Brain Cabinet** — Your External Brain for GPT
