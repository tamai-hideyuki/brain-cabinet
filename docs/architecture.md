# Brain Cabinet 設計書

## 概要

**Brain Cabinet v7.1.0** は、思考ベースの検索型知識システムです。単なるメモアプリではなく、ユーザーの思考を理解し、成長を見守る外部脳として機能します。

| 項目 | 値 |
|------|-----|
| バージョン | v7.1.0 |
| 言語 | TypeScript |
| フレームワーク | Hono (Node.js) |
| データベース | SQLite (Drizzle ORM) |

---

## 1. アーキテクチャ概要

### 1.1 レイヤー構成

```
┌─────────────────────────────────────────────────────────────┐
│                     Request入口                              │
│              (REST Route / Command API)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Dispatcher層                              │
│         (domain.action で適切なサービスに割り振り)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Service層                                │
│    （ビジネスロジック、キャッシュ、非同期処理）             │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   Repository層                              │
│         （データアクセス、トランザクション）                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  SQLite Database                            │
│                (Drizzle ORM)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. データベーススキーマ

### 2.1 テーブル一覧（全38テーブル）

#### コアテーブル

| テーブル | 説明 |
|---------|------|
| **notes** | ノート本体（perspective, deletedAt含む） |
| **noteHistory** | 変更履歴（changeType, changeDetail含む） |
| **noteEmbeddings** | ベクトル埋め込み |
| **noteRelations** | ノート間の関係 |
| **noteImages** | ノート画像埋め込み |

#### クラスタリングテーブル

| テーブル | 説明 |
|---------|------|
| **clusters** | クラスタメタデータ |
| **clusterHistory** | クラスタ遷移履歴 |
| **clusterDynamics** | 日次スナップショット |

#### Temporal Clustering（v7）

| テーブル | 説明 |
|---------|------|
| **clusteringSnapshots** | クラスタリングスナップショット（世代管理） |
| **snapshotClusters** | スナップショット内クラスタ定義 |
| **snapshotNoteAssignments** | スナップショット内ノート割り当て |
| **clusterLineage** | クラスタ継承関係（predecessor追跡） |
| **clusterEvents** | クラスタイベント（split/merge/extinct/emerge） |
| **clusterIdentities** | 論理クラスタID（思考系譜の永続識別子） |

#### グラフ・分析テーブル

| テーブル | 説明 |
|---------|------|
| **conceptGraphEdges** | クラスタ間の影響グラフ |
| **noteInfluenceEdges** | ノート間の影響グラフ |
| **driftEvents** | ドリフト検出イベント |
| **driftAnnotations** | ドリフトアノテーション（ユーザーラベル） |
| **metricsTimeSeries** | 日次メトリクス |
| **analysisCache** | マルチタイムスケール分析キャッシュ |

#### 推論・判断テーブル

| テーブル | 説明 |
|---------|------|
| **noteInferences** | ノート推論結果 |
| **llmInferenceResults** | LLM推論結果（Ollama対応） |
| **promotionNotifications** | 昇格通知 |
| **decisionCounterevidences** | 反証ログ |

#### Spaced Reviewテーブル

| テーブル | 説明 |
|---------|------|
| **reviewSchedules** | SM-2スケジュール |
| **recallQuestions** | 質問管理 |
| **reviewSessions** | レビュー記録 |

#### 運用・ジョブテーブル

| テーブル | 説明 |
|---------|------|
| **jobStatuses** | ジョブステータス |
| **workflowStatus** | ワークフロー進捗 |
| **ptmSnapshots** | 思考モデルスナップショット |

#### ブックマーク・シークレットBOX

| テーブル | 説明 |
|---------|------|
| **bookmarkNodes** | ブックマーク階層構造（libraryPosition, libraryColor含む） |
| **secretBoxFolders** | シークレットBOXフォルダ構造 |
| **secretBoxItems** | シークレットBOXアイテム |

#### コーチング機能

| テーブル | 説明 |
|---------|------|
| **coachingSessions** | コーチングセッション管理 |
| **coachingMessages** | コーチング会話ログ |

#### ポモドーロタイマー

| テーブル | 説明 |
|---------|------|
| **pomodoroSessions** | ポモドーロセッション履歴 |
| **pomodoroTimerState** | ポモドーロタイマー状態 |

#### Voice Evaluation（v7.3）

| テーブル | 説明 |
|---------|------|
| **voiceEvaluationLogs** | 観測者ルール評価ログ |

---

## 3. Dispatchers層

### 3.1 ディスパッチャー一覧（全21個）

単一エンドポイント `/api/v1` を通じてすべての操作をルーティング：

| ディスパッチャー | アクション例 |
|----------------|-----------|
| **note** | note.create, note.get, note.update, note.delete, note.list |
| **search** | search.query, search.categories, search.byTitle |
| **cluster** | cluster.list, cluster.get, cluster.rebuild |
| **clusterDynamics** | clusterDynamics.get |
| **drift** | drift.getTimeline, drift.getState |
| **ptm** | ptm.latest, ptm.history |
| **influence** | influence.graph, influence.topInfluencers |
| **insight** | insight.overview, insight.growth |
| **analytics** | analytics.summary |
| **gpt** | gpt.search, gpt.context, gpt.task |
| **system** | system.health, system.embed, system.rebuildFts |
| **job** | job.getStatus, job.list |
| **workflow** | workflow.reconstruct |
| **rag** | rag.query |
| **decision** | decision.search, decision.context, decision.compare |
| **promotion** | promotion.getCandidates, promotion.dismiss, promotion.promote |
| **review** | review.queue, review.start, review.submit, review.schedule |
| **bookmark** | bookmark.list, bookmark.create, bookmark.update, bookmark.delete |
| **llmInference** | llmInference.run, llmInference.get, llmInference.list |
| **isolation** | isolation.detect, isolation.list |
| **coaching** | coaching.start, coaching.message, coaching.end |

---

## 4. Services層

### 4.1 サービス一覧（全27個）

#### Notes & Content Services

| サービス | 責務 |
|---------|------|
| **notesService** | ノートのCRUD、バッチ操作 |
| **historyService** | 変更履歴の取得・管理 |
| **searchService** | キーワード・セマンティック・ハイブリッド検索 |
| **embeddingService** | MiniLMベクトル化 + HNSWインデックス |
| **noteImages** | ノート画像管理 |

#### Clustering & Analysis Services

| サービス | 責務 |
|---------|------|
| **cluster** | K-Meansクラスタリング、アイデンティティ抽出 |
| **ptm** | Personal Thinking Modelスナップショット生成 |
| **drift** | ドリフト検出・スコア計算 |
| **influence** | 影響グラフ構築・分析 |
| **analytics** | 分析サマリー生成 |
| **semanticChange** | セマンティック変化検出 |
| **isolation** | 孤立ノート検出 |
| **cache** | 分析キャッシュ管理 |

#### Inference & Decision Services

| サービス | 責務 |
|---------|------|
| **inference** | ノート推論（タイプ・意図・確信度分類） |
| **decision** | 判断ノート優先検索 + コンテキスト抽出 |
| **promotion** | 昇格候補検出 |
| **counterevidence** | 反証ログ管理 |
| **timeDecay** | 時間減衰計算 |

#### Spaced Review Services

| サービス | 責務 |
|---------|------|
| **review** | SM-2スケジュール管理、質問生成、セッション記録 |

#### LLM Services

| サービス | 責務 |
|---------|------|
| **gptService** | GPT API連携 |

#### Additional Services

| サービス | 責務 |
|---------|------|
| **bookmark** | ブックマーク管理 |
| **secretBox** | シークレットBOX管理 |
| **coachingService** | コーチングセッション管理 |
| **voiceEvaluation** | 観測者ルール評価 |
| **thinkingReport** | 思考成長レポート |
| **health** | ヘルスチェック |

#### Job & Workflow Services

| サービス | 責務 |
|---------|------|
| **jobs** | ジョブキュー・ワーカー管理 |

---

## 5. ディレクトリ構造

```
brain-cabinet/
├── src/
│   ├── index.ts                 # メインエントリーポイント
│   ├── app.ts                   # Honoアプリ設定
│   ├── config/                  # 設定
│   ├── db/
│   │   ├── client.ts            # DB接続
│   │   └── schema.ts            # スキーマ定義（38テーブル）
│   ├── repositories/            # データ永続化層
│   ├── services/                # ビジネスロジック層（27サービス）
│   ├── dispatchers/             # コマンドディスパッチ（21ディスパッチャー）
│   ├── routes/                  # APIルート
│   ├── middleware/              # ミドルウェア
│   ├── utils/                   # ユーティリティ
│   ├── types/                   # 型定義
│   ├── scripts/                 # バッチスクリプト
│   ├── checker/                 # 整合性チェック
│   ├── importer/                # ノートインポート
│   ├── exporter/                # ノートエクスポート
│   └── syncer/                  # ノート同期
├── drizzle/                     # マイグレーション
├── docs/                        # ドキュメント
└── package.json
```

---

## 6. 主要な型定義

```typescript
// ノートタイプ
type NoteType = "decision" | "learning" | "scratch" | "emotion" | "log"

// 視点タイプ（v8）
type Perspective = "engineer" | "po" | "user" | "cto" | "team" | "stakeholder"

// 意図カテゴリ
type Intent = "architecture" | "design" | "implementation" | "review" | "process" | "people" | "unknown"

// ドリフト関連
type DriftSeverity = "low" | "mid" | "high"
type DriftType = "cluster_bias" | "drift_drop" | "over_focus" | "stagnation" | "divergence"

// クラスタイベント（v7）
type ClusterEventType = "split" | "merge" | "extinct" | "emerge"

// セマンティック変化タイプ（v5.6）
type SemanticChangeType = "drift" | "shift" | "stable"

// 時間減衰プロファイル
type DecayProfile = "stable" | "exploratory" | "situational"
```

---

## 7. 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript |
| ランタイム | Node.js |
| フレームワーク | Hono |
| ORM | Drizzle ORM |
| データベース | SQLite |
| テスト | Vitest |
| ログ | Pino |
| AI/ML | MiniLM (@xenova/transformers) |
| ベクトル検索 | hnswlib-node |
| クラスタリング | ml-kmeans |
| LLM | OpenAI API / Ollama（ローカル） |

---

最終更新: 2026-01-19
