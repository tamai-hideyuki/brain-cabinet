# Brain Cabinet v3.1.0

**思考ベースの検索型知識システム — あなたの思考を理解し、成長を見守る外部脳**

> Brain Cabinet は単なるメモ帳ではありません。
> ノートの**文脈を理解**し、質問に応じて**必要な部分だけを抽出・再構成**する仕組みです。
> v3.0 では**PTM（Personal Thinking Model）**、**Drift分析**、**Influence Graph**、**Cluster Dynamics**、**クラスタ人格化エンジン**を搭載。
> **統合Command API**により、GPT Actionsから全機能にアクセス可能。

---

## なぜ Brain Cabinet なのか？

従来のメモアプリは「保存」と「検索」だけ。Brain Cabinet は違います：

| 従来のメモアプリ | Brain Cabinet v3 |
|----------------|------------------|
| キーワード一致で検索 | **意味を理解**して関連ノートを発見 |
| タグは手動で付ける | **自動でタグ・カテゴリを抽出** |
| 検索結果は羅列 | **TF-IDF + 構造スコア**で最適順に |
| 履歴なし | **Semantic Diff**で思考の変化率を追跡 |
| 単体で完結 | **GPT/Claude と連携**して外部脳化 |
| 整理は手動 | **K-Means クラスタリング**で自動分類 |
| 振り返りは困難 | **PTM Snapshot**で思考モデルを可視化 |
| 成長が見えない | **Drift分析**で成長角度・予測を提供 |
| 知識の関連が不明 | **Influence Graph**で概念の影響関係を追跡 |

---

## 主な特徴

### 1. 統合 Command API（v3 新機能）

すべての操作を単一エンドポイントで実行：

```
POST /api/command
{
  "action": "gpt.search",
  "payload": { "query": "TypeScript" }
}
```

- **単一エンドポイント**: `/api/command` で全機能にアクセス
- **action + payload 形式**: GPT が理解しやすい構造
- **50+ アクション**: 無限にコマンドを追加可能（APIパス増加なし）
- **GPT Actions 最適化**: 30エンドポイント制限を回避

### 2. 三層検索システム

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
- **セマンティック検索**: **ローカル MiniLM** による意味ベースの類似度計算（API不要）
- **ハイブリッド検索**: キーワード(60%) + 意味(40%) を統合した最適解

### 3. PTM（Personal Thinking Model）Snapshot Engine

あなたの「思考モデル」を日次でスナップショット化：

```
┌─────────────────────────────────────────────────────────────┐
│                    PTM Snapshot                              │
├─────────────────────────────────────────────────────────────┤
│  Core Metrics     │ 総ノート数、クラスタ数、優勢クラスタ       │
│  Influence        │ 影響グラフ統計、トップ影響ノート           │
│  Dynamics         │ 成長モード、季節、ドリフト状態             │
│  Stability        │ 安定性スコア、変化検出                    │
└─────────────────────────────────────────────────────────────┘
```

- **Mode**: exploration（探索）, consolidation（統合）, integration（定着）
- **Season**: spring（萌芽期）, summer（成長期）, autumn（収穫期）, winter（休眠期）
- **State**: normal, overheat（過熱）, stagnation（停滞）

### 4. Drift分析

思考の「成長角度」を可視化：

- **Timeline**: 日次Drift値とEMA（指数移動平均）
- **Growth Angle**: 成長の方向と速度（角度・トレンド）
- **Forecast**: 3日後・7日後の成長予測
- **Warning**: 過熱・停滞の自動検出とアドバイス

### 5. Influence Graph

ノート間の「影響関係」を追跡：

- **Influencers**: このノートに影響を与えているノート
- **Influenced**: このノートが影響を与えているノート
- **Stats**: 総エッジ数、平均影響度、トップ影響ノート

### 6. Cluster Dynamics

クラスタの「動態」を分析：

- **Cohesion**: 凝集度（クラスタの密度）
- **Stability**: 安定性スコア（変化の大きさ）
- **Interactions**: クラスタ間の関係性マトリクス
- **Timeline**: クラスタ別の時系列変化

### 7. クラスタ人格化エンジン

各クラスタに「人格」を付与：

- **Identity**: 凝集度・安定性・代表ノートから生成
- **Representatives**: 重心に最も近い代表ノートTop N
- **GPT向けフォーマット**: システムプロンプト付きで出力

---

## GPTでの使い方

### OpenAPI ファイル

| ファイル | 用途 |
|---------|------|
| `openapi-command.json` | **GPT Actions用（推奨）** - 統合Command API |

### セットアップ

1. **OpenAPI仕様をインポート**
   - `openapi-command.json` を ChatGPT の Custom GPT / Actions にアップロード

2. **サーバーを公開**
   - Cloudflare Tunnel でローカルサーバーを公開
   - `https://api.brain-cabinet.com` として設定済み

### Command API アクション一覧

#### Note ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `note.list` | ノート一覧 | `{limit?, offset?}` |
| `note.get` | ノート取得 | `{id}` |
| `note.create` | ノート作成 | `{title, content}` |
| `note.update` | ノート更新 | `{id, content, title?}` |
| `note.delete` | ノート削除 | `{id}` |
| `note.history` | 履歴取得 | `{id}` |
| `note.revert` | 履歴復元 | `{noteId, historyId}` |

#### Search ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `search.query` | 検索実行 | `{query, mode?}` |
| `search.byTitle` | タイトル検索 | `{title, exact?}` |
| `search.categories` | カテゴリ一覧 | - |

#### Cluster ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `cluster.list` | クラスタ一覧 | - |
| `cluster.get` | クラスタ詳細 | `{id}` |
| `cluster.map` | クラスタマップ | `{format?}` |
| `cluster.identity` | アイデンティティ | `{id}` |
| `cluster.representatives` | 代表ノート | `{id, limit?}` |
| `cluster.rebuild` | 再構築 | `{k?, regenerateEmbeddings?}` |

#### PTM ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `ptm.today` | 今日のスナップショット | - |
| `ptm.history` | 履歴 | `{limit?}` |
| `ptm.insight` | インサイト | `{date?}` |
| `ptm.capture` | 手動キャプチャ | `{date?}` |
| `ptm.core` | コアメトリクス | - |
| `ptm.influence` | 影響メトリクス | - |
| `ptm.dynamics` | 動態メトリクス | `{rangeDays?}` |
| `ptm.stability` | 安定性メトリクス | `{date?}` |
| `ptm.summary` | 超軽量サマリー | - |

#### Drift ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `drift.timeline` | 時系列 | `{rangeDays?}` |
| `drift.events` | イベント検出 | `{eventType?}` |
| `drift.summary` | サマリー | `{rangeDays?}` |
| `drift.angle` | 成長角度 | `{rangeDays?}` |
| `drift.forecast` | 予測 | `{rangeDays?}` |
| `drift.warning` | 警告 | `{rangeDays?}` |
| `drift.insight` | 統合インサイト | `{rangeDays?}` |

#### Insight ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `insight.lite` | GPT用簡潔版 | - |
| `insight.full` | 研究モード全データ | - |
| `insight.coach` | 今日の助言 | - |

#### Analytics ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `analytics.summary` | サマリー統計 | - |
| `analytics.timeline` | 時系列 | `{range?}` |
| `analytics.journey` | クラスタ遷移 | `{range?}` |
| `analytics.heatmap` | ヒートマップ | `{year?}` |
| `analytics.trends` | トレンド | `{unit?, range?}` |

#### GPT ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `gpt.search` | GPT向け検索 | `{query, mode?}` |
| `gpt.context` | コンテキスト | `{noteId}` |
| `gpt.task` | タスク推奨 | - |
| `gpt.overview` | 概要 | - |

#### System ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `system.health` | ヘルスチェック | - |
| `system.embed` | テキスト埋め込み | `{text}` |

### プロンプト例とAPI対応表

#### 基本操作

| やりたいこと | GPTへのプロンプト例 | 呼び出されるaction |
|------------|-------------------|-------------------|
| ノート検索 | 「TypeScriptについてのノートを探して」 | `gpt.search` |
| タイトル検索 | 「2025/12/07のログというノートを探して」 | `search.byTitle` |
| ノート詳細 | 「ノートID xxx の内容を見せて」 | `note.get` |
| ノート作成 | 「新しいノートを作成して。タイトルは〇〇」 | `note.create` |

#### 思考状態の把握

| やりたいこと | GPTへのプロンプト例 | 呼び出されるaction |
|------------|-------------------|-------------------|
| 今日の状態 | 「今日の思考状態を教えて」 | `insight.lite` |
| 詳細な状態 | 「PTMの全データを見せて」 | `insight.full` |
| 今日の助言 | 「今日のアドバイスをちょうだい」 | `insight.coach` |
| PTMサマリー | 「PTMの概要を教えて」 | `ptm.summary` |

#### 成長分析

| やりたいこと | GPTへのプロンプト例 | 呼び出されるaction |
|------------|-------------------|-------------------|
| 成長推移 | 「最近の成長推移を見せて」 | `drift.timeline` |
| 成長予測 | 「3日後・7日後の成長予測は？」 | `drift.forecast` |
| 過熱・停滞 | 「思考が過熱してないか確認して」 | `drift.warning` |
| 統合インサイト | 「Driftの総合分析をして」 | `drift.insight` |

#### クラスタ分析

| やりたいこと | GPTへのプロンプト例 | 呼び出されるaction |
|------------|-------------------|-------------------|
| クラスタ一覧 | 「クラスタの一覧を見せて」 | `cluster.list` |
| クラスタ詳細 | 「クラスタ0の詳細を見せて」 | `cluster.get` |
| 人格マップ | 「全クラスタの人格を見せて」 | `cluster.map` |
| クラスタ人格 | 「クラスタ3の人格は？」 | `cluster.identity` |

### 推奨プロンプトパターン

#### 朝のチェックイン
```
今日の思考状態を教えて。助言もあればちょうだい。
```
→ `insight.lite` または `insight.coach`

#### 週次レビュー
```
過去7日間のDriftインサイトと、最も活発だったクラスタを教えて。
```
→ `drift.insight` + `clusterDynamics.summary`

#### 深掘り分析
```
このノート（ID: xxx）の影響関係を分析して。
```
→ `influence.influencers` + `influence.influenced`

#### クラスタ探索
```
クラスタ2の人格と代表ノートを見せて。どんなテーマのクラスタか解説して。
```
→ `cluster.identity` + `cluster.representatives`

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

### 4. インデックス構築

```bash
pnpm init-fts          # FTS5 全文検索インデックス
pnpm init-embeddings   # Embedding 生成（ローカル MiniLM、API不要）
```

### 5. サーバー起動

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
│                 Brain Cabinet Command API                    │
│                                                             │
│     POST /api/command                                       │
│     { "action": "domain.operation", "payload": {...} }      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │                   Dispatchers                       │    │
│  │  noteDispatcher │ searchDispatcher │ gptDispatcher  │    │
│  │  clusterDispatcher │ driftDispatcher │ ptmDispatcher│    │
│  │  analyticsDispatcher │ insightDispatcher            │    │
│  │  influenceDispatcher │ clusterDynamicsDispatcher    │    │
│  │  systemDispatcher                                   │    │
│  └────────────────────────────────────────────────────┘    │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Service Layer                       │   │
│  │  notesService │ searchService │ embeddingService     │   │
│  │  gptService   │ analyticsService                     │   │
│  │  ptmService   │ driftService │ influenceService      │   │
│  │  clusterDynamicsService │ identityService            │   │
│  └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Job Queue                         │   │
│  │  NOTE_ANALYZE (embedding/semantic diff/relations)    │   │
│  │  CLUSTER_REBUILD (K-Means clustering)                │   │
│  │  PTM_SNAPSHOT (daily capture)                        │   │
│  └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Repository Layer                     │   │
│  │  notesRepo │ historyRepo │ searchRepo │ ftsRepo      │   │
│  │  embeddingRepo │ relationRepo │ clusterRepo          │   │
│  │  influenceRepo │ driftRepo │ ptmRepo                 │   │
│  └─────────────────────────────────────────────────────┘   │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 SQLite (libsql)                      │   │
│  │  notes │ note_history │ notes_fts │ note_embeddings  │   │
│  │  note_relations │ clusters │ cluster_dynamics        │   │
│  │  concept_influence │ drift_events │ ptm_snapshots    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Web Framework | Hono |
| Server | @hono/node-server |
| Database | SQLite (libsql) |
| ORM | Drizzle ORM |
| 全文検索 | SQLite FTS5 |
| Embedding | @xenova/transformers (MiniLM, 384次元, ローカル) |
| クラスタリング | ml-kmeans (K-Means++) |
| 形態素解析 | TinySegmenter |
| 差分計算 | diff-match-patch |
| ロギング | Pino + pino-pretty |
| テスト | Vitest |
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

# Embedding 一括生成（ローカル MiniLM、API不要）
pnpm init-embeddings

# テスト実行
pnpm test

# テスト（ウォッチモード）
pnpm test:watch
```

---

## ディレクトリ構成

```
brain-cabinet/
├── src/
│   ├── index.ts                  # エントリーポイント
│   ├── db/                       # データベース接続・スキーマ
│   ├── routes/
│   │   ├── command/              # 統合Command API（v3 新規）
│   │   ├── notes/                # ノート操作 API
│   │   ├── search/               # 検索 API
│   │   ├── gpt/                  # GPT統合 API
│   │   ├── clusters/             # クラスタ API
│   │   ├── analytics/            # Analytics API
│   │   ├── ptm/                  # PTM API
│   │   ├── drift/                # Drift API
│   │   ├── influence/            # Influence API
│   │   ├── cluster-dynamics/     # Cluster Dynamics API
│   │   └── insight/              # Insight API
│   ├── dispatchers/              # Command Dispatchers（v3 新規）
│   │   ├── index.ts              # メインディスパッチャー
│   │   ├── noteDispatcher.ts
│   │   ├── searchDispatcher.ts
│   │   ├── clusterDispatcher.ts
│   │   ├── driftDispatcher.ts
│   │   ├── ptmDispatcher.ts
│   │   ├── analyticsDispatcher.ts
│   │   ├── gptDispatcher.ts
│   │   ├── insightDispatcher.ts
│   │   ├── influenceDispatcher.ts
│   │   ├── clusterDynamicsDispatcher.ts
│   │   └── systemDispatcher.ts
│   ├── types/
│   │   └── command.ts            # Command型定義（v3 新規）
│   ├── services/                 # ビジネスロジック
│   ├── repositories/             # データアクセス層
│   └── utils/                    # ユーティリティ
├── docs/                         # ドキュメント
├── drizzle/                      # マイグレーションファイル
├── openapi-command.json          # GPT Actions用 OpenAPI仕様
├── openapi-command.yaml          # YAML版
└── README.md
```

---

## ロードマップ

### Phase 1（v1.0 完了）
- [x] ノート CRUD
- [x] 差分保存・履歴管理
- [x] TF-IDF 検索
- [x] メタデータ自動抽出
- [x] GPT 統合 API

### Phase 2（v2.0 完了）
- [x] ローカル Embedding（MiniLM, API不要）
- [x] Semantic Diff（意味的変化率追跡）
- [x] Relation Graph（類似/派生ノート自動検出）
- [x] Topic Clustering（K-Means, k=8）
- [x] Analytics Engine（Timeline, Heatmap, Journey, Trends）

### Phase 3（v3.0 完了）
- [x] PTM Snapshot Engine（Core/Influence/Dynamics）
- [x] Drift分析（Timeline, Angle, Forecast, Warning）
- [x] Influence Graph（影響関係追跡）
- [x] Cluster Dynamics（凝集度・安定性・相互作用）
- [x] クラスタ人格化エンジン（Identity, Representatives）
- [x] Insight API（Lite/Full/Coach）
- [x] **統合 Command API**（単一エンドポイント、50+ アクション）
- [x] **GPT Actions 最適化**（承認なし実行、パラメータ明確化）

### Phase 4（予定）
- [ ] 要約生成・保存
- [ ] RAG（質問応答）
- [ ] Webhook / 自動インポート
- [ ] Web UI

---

## ドキュメント

### 開発者向けドキュメント

| ドキュメント | 説明 |
|------------|------|
| [API リファレンス v3](docs/api-reference-v3.md) | 統合 Command API の完全リファレンス |
| [エラーコード一覧](docs/error-codes.md) | 全エラーコードとHTTPステータスマッピング |
| [v3 移行ガイド](docs/migration-v3.md) | v2 → v3 への移行手順と破壊的変更 |

### GPT/AIエージェント向け

| ドキュメント | 説明 |
|------------|------|
| [GPT向け設定ガイド](docs/gpt-instructions-v2.md) | Custom GPT セットアップと推奨プロンプト |
| `openapi-command.json` | GPT Actions 用 OpenAPI 仕様 |

### API クイックリファレンス

すべての操作は `POST /api/command` で実行：

```json
{
  "domain": "note | search | cluster | relation | workflow | gpt",
  "action": "操作名",
  "payload": { ... }
}
```

**主要ドメイン:**

| ドメイン | 主な操作 |
|---------|---------|
| `note` | create, get, update, delete, list, history, revert, batchDelete |
| `search` | keyword, semantic, hybrid |
| `cluster` | list, get, build |
| `relation` | similar, influence |
| `workflow` | reconstruct（クラスタ/Embedding/FTS再構築） |
| `gpt` | search, context, task, overview |

**レスポンス形式:**

```json
// 成功
{ "ok": true, "data": { ... } }

// エラー
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

詳細は [API リファレンス v3](docs/api-reference-v3.md) を参照。

---

## バージョン履歴

### v3.0.0 (Phase 3 完了)
- **統合 Command API**: 全操作を `POST /api/command` で実行
- **Dispatcher パターン**: ドメイン別ディスパッチャーで拡張性確保
- **PTM Snapshot Engine**: 日次思考モデルスナップショット
- **Drift分析**: Timeline, Growth Angle, Forecast, Warning, Insight
- **Influence Graph**: ノート間影響関係の追跡・可視化
- **Cluster Dynamics**: 凝集度・安定性・クラスタ間相互作用
- **クラスタ人格化**: Identity, Representatives, GPT人格フォーマット
- **Insight API**: MetaState Lite/Full, Coach
- **GPT Actions 最適化**: 承認なし実行、x-openai-isConsequential

### v2.0.0 (Phase 2 完了)
- **ローカル Embedding**: OpenAI API不要、MiniLM（384次元）に移行
- **Semantic Diff**: ノート更新時の意味的変化率を自動計算
- **Relation Graph**: ノート間の類似・派生関係を自動検出
- **Topic Clustering**: K-Means（k=8）による自動分類
- **Analytics Engine**: Summary、Timeline、Heatmap、Journey、Trends

### v1.0.0 (Phase 1 完了)
- ノート管理の基本機能
- TF-IDF + 構造スコア検索
- 履歴管理（差分保存、巻き戻し）
- メタデータ自動抽出
- GPT 統合 API

---

**Brain Cabinet v3** — Your External Brain with Personal Thinking Model & Unified Command API
