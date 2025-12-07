# Brain Cabinet v3.0

**思考ベースの検索型知識システム — あなたの思考を理解し、成長を見守る外部脳**

> Brain Cabinet は単なるメモ帳ではありません。
> ノートの**文脈を理解**し、質問に応じて**必要な部分だけを抽出・再構成**する仕組みです。
> v3.0 では**PTM（Personal Thinking Model）**、**Drift分析**、**Influence Graph**、**Cluster Dynamics**、**クラスタ人格化エンジン**を搭載。

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
- **セマンティック検索**: **ローカル MiniLM** による意味ベースの類似度計算（API不要）
- **ハイブリッド検索**: キーワード(60%) + 意味(40%) を統合した最適解

### 2. PTM（Personal Thinking Model）Snapshot Engine（v3 新機能）

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

### 3. Drift分析（v3 新機能）

思考の「成長角度」を可視化：

- **Timeline**: 日次Drift値とEMA（指数移動平均）
- **Growth Angle**: 成長の方向と速度（角度・トレンド）
- **Forecast**: 3日後・7日後の成長予測
- **Warning**: 過熱・停滞の自動検出とアドバイス

### 4. Influence Graph（v3 新機能）

ノート間の「影響関係」を追跡：

- **Influencers**: このノートに影響を与えているノート
- **Influenced**: このノートが影響を与えているノート
- **Stats**: 総エッジ数、平均影響度、トップ影響ノート

### 5. Cluster Dynamics（v3 新機能）

クラスタの「動態」を分析：

- **Cohesion**: 凝集度（クラスタの密度）
- **Stability**: 安定性スコア（変化の大きさ）
- **Interactions**: クラスタ間の関係性マトリクス
- **Timeline**: クラスタ別の時系列変化

### 6. クラスタ人格化エンジン（v3 新機能）

各クラスタに「人格」を付与：

- **Identity**: 凝集度・安定性・代表ノートから生成
- **Representatives**: 重心に最も近い代表ノートTop N
- **GPT向けフォーマット**: システムプロンプト付きで出力

### 7. Insight API（v3 新機能）

GPTが直接参照できる統合エンドポイント：

- **Lite版**: 今日の状態と助言（軽量）
- **Full版**: 全メトリクス（研究モード）
- **Coach**: 今日の助言のみ

---

## GPTでの使い方

### セットアップ

1. **OpenAPI仕様をインポート**
   - `openapi.json` を ChatGPT の Custom GPT / Actions にアップロード

2. **サーバーを公開**
   - ngrok や Cloudflare Tunnel でローカルサーバーを公開

### プロンプト例とAPI対応表

#### 基本操作

| やりたいこと | GPTへのプロンプト例 | 呼び出されるAPI |
|------------|-------------------|----------------|
| ノート検索 | 「TypeScriptについてのノートを探して」 | `GET /api/search?query=TypeScript&mode=hybrid` |
| 意味で検索 | 「非同期処理に関連するノートを意味的に検索」 | `POST /api/gpt/semantic-search` |
| ノート詳細 | 「ノートID xxx の内容を見せて」 | `GET /api/notes/{id}` |
| ノート作成 | 「新しいノートを作成して。タイトルは〇〇」 | `POST /api/notes` |

#### 思考状態の把握（v3推奨）

| やりたいこと | GPTへのプロンプト例 | 呼び出されるAPI |
|------------|-------------------|----------------|
| 今日の状態 | 「今日の思考状態を教えて」 | `GET /api/insight/lite` |
| 詳細な状態 | 「PTMの全データを見せて」 | `GET /api/insight/full` |
| 今日の助言 | 「今日のアドバイスをちょうだい」 | `GET /api/insight/coach` |
| PTMサマリー | 「PTMの概要を教えて」 | `GET /api/ptm/summary` |
| PTMインサイト | 「今日のPTMインサイトは？」 | `GET /api/ptm/insight` |

#### 成長分析（v3推奨）

| やりたいこと | GPTへのプロンプト例 | 呼び出されるAPI |
|------------|-------------------|----------------|
| 成長推移 | 「最近の成長推移を見せて」 | `GET /api/drift/timeline?range=30d` |
| 成長角度 | 「今の成長角度はどのくらい？」 | `GET /api/drift/angle` |
| 成長予測 | 「3日後・7日後の成長予測は？」 | `GET /api/drift/forecast` |
| 過熱・停滞 | 「思考が過熱してないか確認して」 | `GET /api/drift/warning` |
| 統合インサイト | 「Driftの総合分析をして」 | `GET /api/drift/insight` |
| イベント履歴 | 「最近の成長イベントは？」 | `GET /api/drift/events` |

#### 影響関係分析（v3推奨）

| やりたいこと | GPTへのプロンプト例 | 呼び出されるAPI |
|------------|-------------------|----------------|
| 影響統計 | 「影響グラフの統計を見せて」 | `GET /api/influence/stats` |
| 影響サマリー | 「影響関係のサマリーを教えて」 | `GET /api/influence/summary` |
| ノートの影響 | 「このノートの影響関係は？」 | `GET /api/influence/note/{noteId}` |
| 影響元 | 「このノートに影響を与えたノートは？」 | `GET /api/influence/note/{noteId}/influencers` |
| 影響先 | 「このノートが影響を与えたノートは？」 | `GET /api/influence/note/{noteId}/influenced` |

#### クラスタ分析（v3拡張）

| やりたいこと | GPTへのプロンプト例 | 呼び出されるAPI |
|------------|-------------------|----------------|
| クラスタ一覧 | 「クラスタの一覧を見せて」 | `GET /api/clusters` |
| クラスタ詳細 | 「クラスタ0の詳細を見せて」 | `GET /api/clusters/{id}` |
| 人格マップ | 「全クラスタの人格を見せて」 | `GET /api/clusters/map` |
| GPT人格 | 「クラスタ人格をGPT用に出力して」 | `GET /api/clusters/map/gpt` |
| クラスタ人格 | 「クラスタ3の人格は？」 | `GET /api/clusters/{id}/identity` |
| 代表ノート | 「クラスタ5の代表ノートを5件」 | `GET /api/clusters/{id}/representatives?top=5` |
| 動態サマリー | 「クラスタ動態のサマリー」 | `GET /api/cluster-dynamics/summary` |
| 動態インサイト | 「クラスタ動態のインサイト」 | `GET /api/cluster-dynamics/insight` |
| 距離マトリクス | 「クラスタ間の距離を見せて」 | `GET /api/cluster-dynamics/matrix` |

#### 統計・分析

| やりたいこと | GPTへのプロンプト例 | 呼び出されるAPI |
|------------|-------------------|----------------|
| 統計サマリー | 「全体の統計を教えて」 | `GET /api/analytics/summary` |
| 活動履歴 | 「今年の活動ヒートマップを見せて」 | `GET /api/analytics/heatmap?year=2025` |
| トレンド | 「最近6ヶ月のトピックトレンド」 | `GET /api/analytics/trends?range=6m` |
| 遷移履歴 | 「クラスタ遷移の履歴を見せて」 | `GET /api/analytics/journey` |

### 推奨プロンプトパターン

#### 朝のチェックイン
```
今日の思考状態を教えて。助言もあればちょうだい。
```
→ `GET /api/insight/lite` または `GET /api/insight/coach`

#### 週次レビュー
```
過去7日間のDriftインサイトと、最も活発だったクラスタを教えて。
```
→ `GET /api/drift/insight?range=7d` + `GET /api/cluster-dynamics/summary`

#### 深掘り分析
```
このノート（ID: xxx）の影響関係を分析して。
何に影響されて、何に影響を与えているか教えて。
```
→ `GET /api/influence/note/{noteId}`

#### クラスタ探索
```
クラスタ2の人格と代表ノートを見せて。どんなテーマのクラスタか解説して。
```
→ `GET /api/clusters/2/identity` + `GET /api/clusters/2/representatives`

#### 成長予測
```
今の成長ペースで3日後・7日後はどうなりそう？過熱や停滞の兆候はある？
```
→ `GET /api/drift/forecast` + `GET /api/drift/warning`

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
│                    Brain Cabinet API                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ │
│  │ /notes │ │/search │ │  /gpt  │ │/clusters │ │/analytics│ │
│  └────────┘ └────────┘ └────────┘ └──────────┘ └─────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────────────┐ ┌─────────────┐   │
│  │  /ptm  │ │ /drift │ │   /influence   │ │  /insight   │   │
│  └────────┘ └────────┘ └────────────────┘ └─────────────┘   │
│  ┌────────────────────┐                                     │
│  │ /cluster-dynamics  │                                     │
│  └────────────────────┘                                     │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Service Layer                       │   │
│  │  notesService │ searchService │ embeddingService     │   │
│  │  gptService   │ analyticsService                     │   │
│  │  ptmService   │ driftService │ influenceService      │   │
│  │  clusterDynamicsService │ identityService (v3 新規)  │   │
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
│  │  influenceRepo │ driftRepo │ ptmRepo (v3 新規)       │   │
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

### 検索（三層システム）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/search?query=keyword` | キーワード検索（FTS5 + TF-IDF） |
| GET | `/api/search?query=keyword&mode=semantic` | セマンティック検索（Embedding） |
| GET | `/api/search?query=keyword&mode=hybrid` | ハイブリッド検索（推奨） |

### GPT統合 API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/gpt/semantic-search` | セマンティック検索 |
| GET | `/api/gpt/notes/:id/context` | コンテキスト抽出 |
| POST | `/api/gpt/task` | タスク準備 |
| GET | `/api/gpt/health` | ヘルスチェック |

### PTM API（v3 新機能）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/ptm/today` | 今日のPTMスナップショット |
| GET | `/api/ptm/history` | スナップショット履歴 |
| GET | `/api/ptm/insight` | GPT向けインサイト（推奨） |
| POST | `/api/ptm/capture` | 手動キャプチャ |
| GET | `/api/ptm/core` | Coreメトリクスのみ |
| GET | `/api/ptm/influence` | Influenceメトリクスのみ |
| GET | `/api/ptm/dynamics` | Dynamicsメトリクスのみ |
| GET | `/api/ptm/stability` | Stabilityメトリクスのみ |
| GET | `/api/ptm/summary` | 超軽量サマリー |

### Drift API（v3 新機能）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/drift/timeline` | Driftタイムライン |
| GET | `/api/drift/events` | イベント履歴 |
| GET | `/api/drift/summary` | サマリー（GPT向け） |
| GET | `/api/drift/angle` | 成長角度 |
| GET | `/api/drift/forecast` | 3日後・7日後予測 |
| GET | `/api/drift/warning` | 過熱・停滞警告 |
| GET | `/api/drift/insight` | 統合インサイト（GPT推奨） |

### Influence API（v3 新機能）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/influence/stats` | グラフ統計 |
| GET | `/api/influence/summary` | サマリー（GPT向け） |
| GET | `/api/influence/note/:noteId` | ノートの影響関係 |
| GET | `/api/influence/note/:noteId/influencers` | 影響元ノート |
| GET | `/api/influence/note/:noteId/influenced` | 影響先ノート |

### Cluster Dynamics API（v3 新機能）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/cluster-dynamics/summary` | 動態サマリー |
| GET | `/api/cluster-dynamics/snapshot` | 日次スナップショット |
| GET | `/api/cluster-dynamics/timeline/:clusterId` | クラスタ別タイムライン |
| POST | `/api/cluster-dynamics/capture` | 手動キャプチャ |
| GET | `/api/cluster-dynamics/matrix` | クラスタ間距離マトリクス |
| GET | `/api/cluster-dynamics/insight` | インサイト（GPT向け） |

### Insight API（v3 新機能）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/insight/lite` | MetaState Lite（GPT推奨） |
| GET | `/api/insight/full` | MetaState Full（研究モード） |
| GET | `/api/insight/coach` | 今日の助言のみ |

### Cluster API（v3 拡張）

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/clusters` | クラスタ一覧 |
| GET | `/api/clusters/map` | 全クラスタIdentity |
| GET | `/api/clusters/map/gpt` | GPT人格化エンジン用 |
| GET | `/api/clusters/:id` | クラスタ詳細 |
| GET | `/api/clusters/:id/identity` | クラスタIdentity |
| GET | `/api/clusters/:id/representatives` | 代表ノートTop N |
| POST | `/api/clusters/rebuild` | クラスタ再構築 |

### Analytics API

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| GET | `/api/analytics/summary` | サマリー統計 |
| GET | `/api/analytics/timeline?range=30d` | Semantic Diff 時系列 |
| GET | `/api/analytics/journey?range=90d` | クラスタ遷移履歴 |
| GET | `/api/analytics/heatmap?year=2025` | 年間活動ヒートマップ |
| GET | `/api/analytics/trends?unit=month&range=6m` | クラスタ別トレンド |

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
│   ├── routes/                   # HTTP ルーティング
│   │   ├── notes/                # ノート操作 API
│   │   ├── search/               # 検索 API
│   │   ├── gpt/                  # GPT統合 API
│   │   ├── clusters/             # クラスタ API（v3 拡張）
│   │   ├── analytics/            # Analytics API
│   │   ├── ptm/                  # PTM API（v3 新規）
│   │   ├── drift/                # Drift API（v3 新規）
│   │   ├── influence/            # Influence API（v3 新規）
│   │   ├── cluster-dynamics/     # Cluster Dynamics API（v3 新規）
│   │   └── insight/              # Insight API（v3 新規）
│   ├── services/                 # ビジネスロジック
│   │   ├── searchService.ts      # TF-IDF + 構造スコア
│   │   ├── embeddingService.ts   # Embedding 生成・類似度計算
│   │   ├── gptService.ts         # GPT向けデータ整形
│   │   ├── analyticsService.ts   # Analytics エンジン
│   │   ├── ptm/                  # PTM エンジン（v3 新規）
│   │   ├── drift/                # Drift エンジン（v3 新規）
│   │   ├── influence/            # Influence エンジン（v3 新規）
│   │   ├── cluster/              # Cluster Dynamics・Identity（v3 新規）
│   │   └── jobs/                 # 非同期ジョブ
│   ├── repositories/             # データアクセス層
│   └── utils/                    # ユーティリティ
├── docs/                         # ドキュメント
├── drizzle/                      # マイグレーションファイル
├── openapi.json                  # OpenAPI 仕様書（v3 更新）
├── brain-cabinet-mode.md         # GPT 人格設定
└── brain-cabinet-tools.json      # OpenAI Actions 定義
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
- [x] GPT統合強化（クラスタ人格GPTフォーマット）

### Phase 4（予定）
- [ ] 要約生成・保存
- [ ] RAG（質問応答）
- [ ] Webhook / 自動インポート
- [ ] Web UI

---

## バージョン履歴

### v3.0.0 (Phase 3 完了)
- **PTM Snapshot Engine**: 日次思考モデルスナップショット（Core/Influence/Dynamics）
- **Drift分析**: Timeline, Growth Angle, Forecast, Warning, Insight
- **Influence Graph**: ノート間影響関係の追跡・可視化
- **Cluster Dynamics**: 凝集度・安定性・クラスタ間相互作用
- **クラスタ人格化**: Identity, Representatives, GPT人格フォーマット
- **Insight API**: MetaState Lite/Full, Coach
- **Mode/Season/State**: 探索/統合/定着、春夏秋冬、過熱/停滞検出

### v2.0.0 (Phase 2 完了)
- **ローカル Embedding**: OpenAI API不要、MiniLM（384次元）に移行
- **Semantic Diff**: ノート更新時の意味的変化率を自動計算
- **Relation Graph**: ノート間の類似（0.85+）・派生（0.92+）関係を自動検出
- **Topic Clustering**: K-Means（k=8）による自動分類
- **Analytics Engine**: Summary、Timeline、Heatmap、Journey、Trends

### v1.0.0 (Phase 1 完了)
- ノート管理の基本機能
- TF-IDF + 構造スコア検索
- 履歴管理（差分保存、巻き戻し）
- メタデータ自動抽出
- GPT 統合 API

---

**Brain Cabinet v3** — Your External Brain with Personal Thinking Model
