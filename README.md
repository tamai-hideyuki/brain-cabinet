# Brain Cabinet v1.0

**個人の思考ログを構造化し、GPTと連携して再利用するためのナレッジ基盤**

> **Note**: このファイルが正式なドキュメントです。`docs/` 配下のファイルはバージョン別スナップショットや補助資料です。

---

## 概要

Brain Cabinet は、あなたの思考（ノート、メモ、アイデア）を構造化して保存し、GPT が「外部脳」として活用できるようにする REST API サービスです。

### 主な特徴

- **Markdownノートのインポート**: 既存のノート資産をそのまま活用
- **メタデータ自動抽出**: タグ、カテゴリ、見出しを自動分類
- **差分保存・履歴管理**: 思考の変遷を追跡
- **TF-IDF 全文検索**: 日本語対応の高精度検索
- **GPT統合 API**: ChatGPT / GPT-4 が直接利用可能な形式

---

## クイックスタート

### 1. インストール

```bash
git clone https://github.com/your-username/brain-cabinet.git
cd brain-cabinet
pnpm install
```

### 2. データベース初期化

```bash
pnpm migrate
```

### 3. ノートのインポート

```bash
pnpm import-notes -- --dir /path/to/your/notes
```

### 4. サーバー起動

```bash
pnpm dev
# → http://localhost:3000
```

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                      GPT / Claude                        │
│                  （外部脳として利用）                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Brain Cabinet API                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  /notes  │  │ /search  │  │  /gpt    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│        │            │             │                     │
│        ▼            ▼             ▼                     │
│  ┌─────────────────────────────────────────────┐       │
│  │              Service Layer                   │       │
│  │  notesService │ searchService │ gptService   │       │
│  └─────────────────────────────────────────────┘       │
│        │                                                │
│        ▼                                                │
│  ┌─────────────────────────────────────────────┐       │
│  │            Repository Layer                  │       │
│  │  notesRepo │ historyRepo │ searchRepo        │       │
│  └─────────────────────────────────────────────┘       │
│        │                                                │
│        ▼                                                │
│  ┌─────────────────────────────────────────────┐       │
│  │           SQLite (libsql)                    │       │
│  │  notes │ note_history                        │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## API リファレンス

### ノート操作

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/notes` | ノート一覧取得 |
| GET | `/api/notes/:id` | ノート詳細取得 |
| POST | `/api/notes` | ノート作成 |
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

### 検索

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/search?query=keyword` | キーワード検索 |
| GET | `/api/search?query=keyword&mode=semantic` | 意味検索（Embedding） |
| GET | `/api/search?query=keyword&mode=hybrid` | ハイブリッド検索 |
| GET | `/api/search?query=keyword&category=技術` | カテゴリフィルター |
| GET | `/api/search?query=keyword&tags=typescript` | タグフィルター |
| GET | `/api/search/categories` | カテゴリ一覧 |

### GPT統合 API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/gpt/search` | 複合検索（関連度付き） |
| GET | `/api/gpt/notes/:id/context` | コンテキスト抽出 |
| POST | `/api/gpt/task` | タスク準備 |
| GET | `/api/gpt/overview` | 統計情報 |
| GET | `/api/gpt/tasks` | タスクタイプ一覧 |

---

## GPT連携

### OpenAI GPTs / Actions での利用

1. **api-tools.json をインポート**
   - `docs/api-tools.json` または ルートの `brain-cabinet-tools.json` を OpenAI の Actions 設定にアップロード

2. **System Prompt を設定**
   - `docs/brain-cabinet-mode.md` または ルートの `brain-cabinet-mode.md` の内容を System Instructions に追加

3. **サーバーを公開**
   - ngrok や Cloudflare Tunnel でローカルサーバーを公開
   - または VPS にデプロイ

### ChatGPT での利用例

```
ユーザー: TypeScriptについて教えて

GPT: [search_notes API を呼び出し]
     Brain Cabinet に5件の関連ノートがありました。

     最も関連度の高いノート「TypeScript入門」によると...

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

### 使用例

```bash
# 要点抽出
curl -X POST http://localhost:3000/api/gpt/task \
  -H "Content-Type: application/json" \
  -d '{"type": "extract_key_points", "noteId": "abc123"}'

# 関連ノート検索
curl -X POST http://localhost:3000/api/gpt/task \
  -H "Content-Type: application/json" \
  -d '{"type": "find_related", "query": "TypeScript"}'
```

---

## カテゴリ

自動分類されるカテゴリ一覧:

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

## 検索スコアリング

TF-IDF ベースのスコアリングに加え、以下の要素を考慮:

| 要素 | 重み | 説明 |
|------|------|------|
| タイトルマッチ | ×3.0 | タイトルに含まれるキーワード |
| 見出しマッチ | ×2.0 | 見出しに含まれるキーワード |
| 本文マッチ | ×1.0 | 本文に含まれるキーワード |
| 更新日（7日以内） | +0.3 | 最近更新されたノート |
| 更新日（30日以内） | +0.2 | 比較的新しいノート |
| 更新日（90日以内） | +0.1 | やや古いノート |
| カテゴリマッチ | +0.2 | フィルターと一致 |
| タグマッチ | +0.2 | フィルターと一致 |
| 長さペナルティ | -0.1〜 | 短すぎるノートは減点 |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Web Framework | Hono |
| Server | @hono/node-server |
| Database | SQLite (libsql) |
| ORM | Drizzle ORM |
| 全文検索 | FTS5 |
| Embedding | OpenAI text-embedding-3-small |
| 形態素解析 | TinySegmenter |
| 差分計算 | diff-match-patch |
| ロギング | Pino + pino-pretty |
| 言語 | TypeScript |
| パッケージマネージャ | pnpm |

---

## ディレクトリ構成

```
brain-cabinet/
├── src/
│   ├── index.ts                  # エントリーポイント
│   ├── db/
│   │   ├── client.ts             # DB接続
│   │   └── schema.ts             # Drizzle スキーマ
│   ├── routes/
│   │   ├── notes/
│   │   │   ├── index.ts          # ルート統合
│   │   │   ├── crud.ts           # CRUD操作
│   │   │   └── history.ts        # 履歴関連
│   │   ├── search/
│   │   │   └── index.ts          # 検索API
│   │   └── gpt/
│   │       ├── index.ts          # ルート統合
│   │       ├── search.ts         # GPT向け検索
│   │       ├── context.ts        # コンテキスト取得
│   │       ├── task.ts           # タスク実行
│   │       └── overview.ts       # 概要情報
│   ├── services/
│   │   ├── notesService.ts       # ノート操作
│   │   ├── historyService.ts     # 履歴管理
│   │   ├── searchService.ts      # 検索エンジン
│   │   ├── embeddingService.ts   # Embedding生成
│   │   └── gptService.ts         # GPT統合
│   ├── repositories/
│   │   ├── notesRepo.ts          # ノートDB操作
│   │   ├── historyRepo.ts        # 履歴DB操作
│   │   ├── searchRepo.ts         # 検索クエリ
│   │   ├── ftsRepo.ts            # FTS5インデックス
│   │   └── embeddingRepo.ts      # Embedding保存
│   ├── importer/
│   │   └── import-notes.ts       # インポーター
│   ├── exporter/
│   │   ├── export-notes.ts       # エクスポーター
│   │   └── markdown-formatter.ts # Markdownフォーマッター
│   ├── syncer/
│   │   └── sync-notes.ts         # 差分同期
│   ├── checker/
│   │   └── integrity-check.ts    # 整合性チェック
│   ├── scripts/
│   │   ├── init-fts.ts           # FTS5初期化
│   │   └── init-embeddings.ts    # Embedding一括生成
│   ├── utils/
│   │   ├── diff.ts               # 差分計算
│   │   ├── logger.ts             # Pinoロガー
│   │   ├── markdown.ts           # Markdown正規化
│   │   ├── markdown-parser.ts    # Markdownパーサー
│   │   ├── metadata.ts           # メタデータ抽出
│   │   ├── normalize.ts          # テキスト正規化
│   │   └── slugify.ts            # URL化
│   └── types/
│       └── tiny-segmenter.d.ts   # TinySegmenter型定義
├── docs/
│   ├── README.v1.0.md
│   ├── usage.md                  # 使い方ガイド
│   ├── design-plan.md            # 設計計画書
│   ├── brain-cabinet-mode.md     # GPT人格設定
│   ├── api-tools.json            # OpenAI Tools定義
│   └── usecase-presets.md        # ユースケース集
├── notes/                        # サンプルノート
├── drizzle/                      # マイグレーション
├── data.db                       # SQLite DB
├── brain-cabinet-mode.md         # GPT人格設定（ルート）
├── brain-cabinet-tools.json      # OpenAI Tools定義（ルート）
├── openapi.json                  # OpenAPI仕様
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

---

## 開発コマンド

```bash
# 開発サーバー起動
pnpm dev

# DB マイグレーション適用
pnpm migrate

# ノートインポート
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

**Brain Cabinet** - Your External Brain for GPT
