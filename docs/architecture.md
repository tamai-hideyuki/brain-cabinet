# Brain Cabinet 設計書

## 概要

**Brain Cabinet v5.2.0** は、思考ベースの検索型知識システムです。単なるメモアプリではなく、ユーザーの思考を理解し、成長を見守る外部脳として機能します。

| 項目 | 値 |
|------|-----|
| バージョン | v5.2.0 (Decision-First + Spaced Review + Bookmarks) |
| 言語 | TypeScript |
| フレームワーク | Hono (Node.js) |
| データベース | SQLite (Drizzle ORM) |
| 総コード行数 | 約26,000行 |

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

### 1.2 依存関係の方向

```
Routes層
  ↓ (依存)
Dispatchers層
  ↓ (依存)
Services層
  ├─→ embeddingService
  ├─→ searchService
  ├─→ clusterService
  ├─→ inference
  ├─→ decision
  └─→ review
  ↓ (依存)
Repositories層
  ├─→ notesRepo
  ├─→ embeddingRepo
  ├─→ clusterRepo
  ├─→ relationRepo
  ├─→ reviewRepo
  └─→ ...
  ↓ (依存)
Database層
  └─→ SQLite + Drizzle ORM

Utils層 (横断的に参照される)
  ├─ logger
  ├─ errors
  ├─ validation
  ├─ normalize
  └─ ...
```

---

## 2. データベーススキーマ

### 2.1 テーブル一覧（全21テーブル）

#### コアテーブル

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **notes** | ノート本体 | id(PK), title, content, path, tags(JSON), category, clusterId, createdAt, updatedAt |
| **note_history** | 変更履歴 | id(PK), noteId, content, diff, semanticDiff, prevClusterId, newClusterId, createdAt |
| **note_embeddings** | ベクトル埋め込み | noteId(PK), embedding(blob), model, dimensions, vectorNorm, semanticDiff, clusterId |
| **note_relations** | ノート間の関係 | id(PK), sourceNoteId, targetNoteId, relationType, score, createdAt |

#### クラスタリングテーブル

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **clusters** | クラスタメタデータ | id(PK), centroid(base64), size, sampleNoteId, createdAt, updatedAt |
| **cluster_history** | クラスタ遷移履歴 | id(PK), noteId, clusterId, assignedAt |
| **cluster_dynamics** | 日次スナップショット | id(PK), date, clusterId, centroid(blob), cohesion, noteCount, interactions(JSON), stabilityScore |

#### グラフ・分析テーブル

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **concept_graph_edges** | クラスタ間の影響グラフ | id(PK), sourceCluster, targetCluster, weight(0-1), mutual, lastUpdated |
| **note_influence_edges** | ノート間の影響グラフ | id(PK), sourceNoteId, targetNoteId, weight, cosineSim, driftScore, createdAt |
| **drift_events** | ドリフト検出イベント | id(PK), detectedAt, severity(low/mid/high), type, message, relatedCluster, resolvedAt |
| **metrics_time_series** | 日次メトリクス | date(PK), noteCount, avgSemanticDiff, dominantCluster, entropy, growthVector(blob) |

#### 推論・判断テーブル（v4）

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **note_inferences** | ノート推論結果 | id(PK), noteId, type, intent, confidence, confidenceDetail(JSON), decayProfile, model, reasoning |
| **promotion_notifications** | 昇格通知 | id(PK), noteId, triggerType, source, suggestedType, reason, confidence, reasonDetail(JSON), status, createdAt, resolvedAt |
| **decision_counterevidences** | 反証ログ | id(PK), decisionNoteId, type, content, sourceNoteId, severityScore, severityLabel, createdAt |

#### Spaced Reviewテーブル（v4.5）

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **review_schedules** | SM-2スケジュール | id(PK), noteId, easinessFactor, interval, repetition, nextReviewAt, lastReviewedAt, scheduledBy, isActive, fixedRevisionId |
| **recall_questions** | 質問管理 | id(PK), noteId, questionType, question, expectedKeywords(JSON), source, isActive, contentHash |
| **review_sessions** | レビュー記録 | id(PK), noteId, scheduleId, quality(0-5), responseTimeMs, questionsAttempted, questionsCorrect, easinessFactorBefore/After, intervalBefore/After |

#### 運用・ジョブテーブル

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **job_statuses** | ジョブステータス | id(PK), type, status, payload(JSON), result(JSON), error, progress, progressMessage, createdAt, startedAt, completedAt |
| **workflow_status** | ワークフロー進捗 | id(PK), workflow, status, progress(JSON), clusterJobId, startedAt, completedAt, error |
| **ptm_snapshots** | 思考モデルスナップショット | id(PK), capturedAt, centerOfGravity(blob), clusterStrengths(blob), influenceMap(blob), imbalanceScore, growthDirection(blob), summary(text) |

#### ブックマークテーブル（v5.2）

| テーブル | 説明 | 主要カラム |
|---------|------|---------|
| **bookmark_nodes** | ブックマーク階層構造 | id(PK), parentId, type(folder/note/link), name, noteId, url, position, isExpanded, createdAt, updatedAt |

### 2.2 ER図

```
notes (中心)
  ├── note_embeddings (1:1)
  ├── note_history (1:N)
  ├── note_relations (N:N)
  │   └── relationType: similar, derived
  ├── note_inferences (1:N)
  │   └── type: decision/learning/scratch/emotion/log
  ├── note_influence_edges (N:N)
  ├── promotion_notifications (1:N)
  ├── decision_counterevidences (1:N)
  ├── review_schedules (1:1)
  ├── recall_questions (1:N)
  ├── review_sessions (1:N)
  └── bookmark_nodes (1:N, type="note")

clusters
  ├── cluster_history (1:N)
  └── cluster_dynamics (1:N)

concept_graph_edges
  └── sourceCluster → targetCluster

bookmark_nodes (v5.2)
  └── parentId → bookmark_nodes (自己参照、階層構造)
```

### 2.3 主要な型定義

```typescript
// ノートタイプ（v4 Decision-First）
type NoteType = "decision" | "learning" | "scratch" | "emotion" | "log"

// 意図カテゴリ
type Intent = "architecture" | "design" | "implementation" | "review" | "process" | "people" | "unknown"

// リレーション種類
type RelationType = "similar" | "derived" | "reference" | "summary_of"

// ドリフト関連
type DriftSeverity = "low" | "mid" | "high"
type DriftType = "cluster_bias" | "drift_drop" | "over_focus" | "stagnation" | "divergence"

// 信頼度詳細分解（v4.1）
type ConfidenceDetail = {
  structural: number    // 構文ベース
  experiential: number  // 経験ベース
  temporal: number      // 時間ベース
}

// 時間減衰プロファイル（v4.2）
type DecayProfile = "stable" | "exploratory" | "situational"

// ブックマークノードタイプ（v5.2）
type BookmarkNodeType = "folder" | "note" | "link"
```

---

## 3. Repositories層

### 3.1 リポジトリ一覧

| リポジトリ | ファイル | 責務 |
|-----------|----------|------|
| **notesRepo** | `notesRepo.ts` | ノートのCRUD + FTS同期 |
| **embeddingRepo** | `embeddingRepo.ts` | ベクトル埋め込み管理 |
| **clusterRepo** | `clusterRepo.ts` | クラスタデータ管理 |
| **relationRepo** | `relationRepo.ts` | ノート関係管理 |
| **reviewRepo** | `reviewRepo.ts` | Spaced Review管理 |
| **historyRepo** | `historyRepo.ts` | 変更履歴管理 |
| **ftsRepo** | `ftsRepo.ts` | FTS5全文検索インデックス |
| **searchRepo** | `searchRepo.ts` | キーワード検索 |
| **jobStatusRepo** | `jobStatusRepo.ts` | ジョブ管理 |
| **workflowStatusRepo** | `workflowStatusRepo.ts` | ワークフロー進捗 |

### 3.2 主要メソッド

#### notesRepo

```typescript
findAllNotes()           // 全ノート取得
findNoteById(id)         // ID指定取得
findNotesByIds(ids)      // 複数ID取得
createNoteInDB(note)     // ノート作成（FTS同期）
updateNoteInDB(id, data) // ノート更新（FTS同期）
deleteNoteInDB(id)       // ノート削除（関連データ含む）
updateNotesCategoryInDB(ids, category) // バッチカテゴリ更新
```

#### embeddingRepo

```typescript
saveEmbedding(noteId, embedding, model, dimensions)
getEmbedding(noteId)
deleteEmbedding(noteId)
getAllEmbeddings()
hasEmbedding(noteId)
countEmbeddings()
```

#### reviewRepo

```typescript
getScheduleByNoteId(noteId)
createSchedule(schedule)
updateScheduleAfterReview(id, updates)
getQuestionsByNoteId(noteId)
createQuestions(questions)
logReviewSession(session)
getReviewStats(noteId)
```

### 3.3 トランザクションパターン

```typescript
// ノート削除時は全関連データをトランザクション内で削除
await db.transaction(async (tx) => {
  await tx.delete(noteInfluenceEdges).where(...)
  await deleteClusterHistoryByNoteIdRaw(tx, id)
  await deleteAllRelationsForNoteRaw(tx, id)
  await deleteHistoryByNoteIdRaw(tx, id)
  await deleteEmbeddingRaw(tx, id)
  await deleteFTSRaw(tx, id)
  await tx.delete(notes).where(eq(notes.id, id))
})
```

---

## 4. Services層

### 4.1 サービス一覧

#### Notes & Content Services

| サービス | ディレクトリ | 責務 |
|---------|-------------|------|
| **notesService** | `services/notesService/` | ノートのCRUD、バッチ操作、キャッシュ無効化 |
| **historyService** | `services/historyService.ts` | 変更履歴の取得・管理 |
| **searchService** | `services/searchService/` | キーワード・セマンティック・ハイブリッド検索 |
| **embeddingService** | `services/embeddingService/` | MiniLMベクトル化 + HNSWインデックス |

#### Clustering & Analysis Services

| サービス | ディレクトリ | 責務 |
|---------|-------------|------|
| **cluster** | `services/cluster/` | K-Meansクラスタリング、アイデンティティ抽出 |
| **ptm** | `services/ptm/` | Personal Thinking Modelスナップショット生成 |
| **drift** | `services/drift/` | ドリフト検出・スコア計算 |
| **influence** | `services/influence/` | 影響グラフ構築・分析 |
| **analytics** | `services/analytics/` | 分析サマリー生成 |

#### Inference & Decision Services

| サービス | ディレクトリ | 責務 |
|---------|-------------|------|
| **inference** | `services/inference/` | ノート推論（タイプ・意図・確信度分類） |
| **decision** | `services/decision/` | 判断ノート優先検索 + コンテキスト抽出 |
| **promotion** | `services/promotion/` | 昇格候補検出 |
| **counterevidence** | `services/counterevidence/` | 反証ログ管理 |

#### Spaced Review Services

| サービス | ディレクトリ | 責務 |
|---------|-------------|------|
| **review** | `services/review/` | SM-2スケジュール管理、質問生成、セッション記録 |

#### Job & Workflow Services

| サービス | ディレクトリ | 責務 |
|---------|-------------|------|
| **job-queue** | `services/jobs/job-queue.ts` | ジョブキュー（メモリ内） |
| **job-worker** | `services/jobs/job-worker.ts` | NOTE_ANALYZEジョブ処理 |
| **cluster-worker** | `services/jobs/cluster-worker.ts` | CLUSTER_REBUILDジョブ処理 |

### 4.2 検索サービスの構成

```
searchNotes (キーワード検索)
  ├── TF-IDF スコア（形態素解析 + IDFキャッシュ）
  ├── 構造スコア（タイトル・見出し一致）
  ├── 新規性スコア（Recency）
  ├── 長さ補正（短文ペナルティ）
  └── メタデータスコア（カテゴリ・タグ）

searchNotesSemantic (セマンティック検索)
  ├── MiniLM で Embedding化
  └── HNSW インデックスで類似ノート検索

searchNotesHybrid (ハイブリッド検索)
  └── キーワード(60%) + セマンティック(40%) を統合
```

### 4.3 推論エンジンの構成

```
Input: ノート本文
  ↓
Rule-based Classification Engine
  ├─ 言い切り・断定パターン検出 → structural confidence
  ├─ 過去の判断との類似度 → experiential confidence
  ├─ 更新頻度・繰り返し → temporal confidence
  └─ 複合スコア計算（加重平均）
  ↓
Output:
  ├─ type: decision/learning/scratch/emotion/log
  ├─ intent: architecture/design/implementation/...
  ├─ confidence: 総合信頼度（0-1）
  ├─ confidenceDetail: { structural, experiential, temporal }
  ├─ decayProfile: stable/exploratory/situational
  └─ reasoning: 分類理由
```

### 4.4 Service間の依存関係

```
notesService
  ├── embeddingService (NOTE_ANALYZE で embedding 生成)
  ├── searchService (IDF キャッシュ無効化)
  ├── inference (推論実行)
  └── job-queue (NOTE_ANALYZE ジョブ追加)

searchService
  ├── embeddingService (セマンティック検索)
  └── normalizer/tokenizer (TF-IDF 計算)

embeddingService
  ├── hnswIndex (HNSW インデックス)
  └── clusterService (クラスタ再構築)

clusterService
  ├── cluster/identityService
  ├── drift (ドリフト分析)
  └── influence (影響グラフ)

inference
  ├── promotion (昇格候補検出)
  └── review (レビュー自動スケジュール)

decision
  ├── searchService (ハイブリッド検索)
  ├── inference (推論結果取得)
  └── counterevidence (反証ログ取得)
```

---

## 5. Dispatchers層

### 5.1 ディスパッチャー一覧

単一エンドポイント `/api/v1` を通じてすべての操作をルーティング：

| ディスパッチャー | ファイル | アクション例 |
|----------------|----------|-----------|
| **noteDispatcher** | `noteDispatcher.ts` | note.create, note.get, note.update, note.delete, note.list |
| **searchDispatcher** | `searchDispatcher.ts` | search.query, search.categories, search.byTitle |
| **clusterDispatcher** | `clusterDispatcher.ts` | cluster.list, cluster.get, cluster.rebuild |
| **driftDispatcher** | `driftDispatcher.ts` | drift.getTimeline, drift.getState |
| **ptmDispatcher** | `ptmDispatcher.ts` | ptm.latest, ptm.history |
| **influenceDispatcher** | `influenceDispatcher.ts` | influence.graph, influence.topInfluencers |
| **clusterDynamicsDispatcher** | `clusterDynamicsDispatcher.ts` | clusterDynamics.get |
| **insightDispatcher** | `insightDispatcher.ts` | insight.overview, insight.growth |
| **analyticsDispatcher** | `analyticsDispatcher.ts` | analytics.summary |
| **gptDispatcher** | `gptDispatcher.ts` | gpt.search, gpt.context, gpt.task |
| **systemDispatcher** | `systemDispatcher.ts` | system.health, system.embed, system.rebuildFts |
| **jobDispatcher** | `jobDispatcher.ts` | job.getStatus, job.list |
| **workflowDispatcher** | `workflowDispatcher.ts` | workflow.reconstruct |
| **ragDispatcher** | `ragDispatcher.ts` | rag.query |
| **decisionDispatcher** | `decisionDispatcher.ts` | decision.search, decision.context, decision.compare |
| **promotionDispatcher** | `promotionDispatcher.ts` | promotion.getCandidates, promotion.dismiss, promotion.promote |
| **reviewDispatcher** | `reviewDispatcher.ts` | review.queue, review.start, review.submit, review.schedule, review.list, review.fixRevision, review.unfixRevision |

### 5.2 コマンドディスパッチの流れ

```
POST /api/v1
{
  "action": "note.create",
  "payload": { "title": "...", "content": "..." }
}
  ↓
dispatch(cmd: BrainCommand)
  ↓
dispatchers.get("note.create")
  ↓
noteDispatcher.create(payload)
  ↓
notesService.createNote(title, content)
  ↓
return CommandResponse
```

---

## 6. Routes層

### 6.1 REST APIエンドポイント

#### Note API
```
GET    /api/notes              - ノート一覧取得
POST   /api/notes              - ノート作成
GET    /api/notes/:id          - ノート詳細取得
PUT    /api/notes/:id          - ノート更新
DELETE /api/notes/:id          - ノート削除
```

#### Search API
```
GET /api/search
  ?query=...
  &mode=keyword|semantic|hybrid
  &category=...
  &tags=...
```

#### Cluster API
```
GET  /api/clusters             - クラスタ一覧
POST /api/clusters/rebuild     - クラスタ再構築
```

#### PTM API
```
GET /api/ptm/latest            - 最新スナップショット
GET /api/ptm/history           - スナップショット履歴
```

#### Analysis API
```
GET /api/analytics/summary     - 分析サマリー
GET /api/drift/timeline        - ドリフト時系列
GET /api/influence/graph       - 影響グラフ
```

#### GPT API
```
POST /api/gpt/search           - GPT向け複合検索
POST /api/gpt/context          - コンテキスト抽出
POST /api/gpt/task             - タスク実行
```

#### Command API（単一エンドポイント）
```
POST /api/v1
{
  "action": "domain.action",
  "payload": { ... }
}
```

---

## 7. Utils層

### 7.1 ユーティリティ一覧

| モジュール | ファイル | 機能 |
|-----------|----------|------|
| **logger** | `utils/logger/` | Pinoベースのログ出力 |
| **errors** | `utils/errors/` | AppError, ValidationError, NotFoundError |
| **validation** | `utils/validation/` | 入力値バリデーション |
| **normalize** | `utils/normalize/` | テキスト正規化 |
| **markdown** | `utils/markdown/` | Markdownパース・抽出 |
| **markdown-parser** | `utils/markdown-parser/` | 見出し・リスト・コードブロック抽出 |
| **metadata** | `utils/metadata/` | ノートメタデータ抽出 |
| **slugify** | `utils/slugify/` | URLスラッグ生成 |
| **diff** | `utils/diff/` | テキスト差分計算 |
| **math** | `utils/math/` | cosine similarity, buffer変換 |

### 7.2 バリデーション

```typescript
validateTitle(title)      // 1〜500文字
validateContent(content)  // 1〜100,000文字
validateId(id)            // UUIDフォーマット
validateCategory(category) // CATEGORIESリストに含まれるか
validateIdArray(ids)      // 配列、100件以下、全てUUID
```

### 7.3 エラーコード体系

```
VALIDATION_* (400)
  ├─ VALIDATION_REQUIRED
  ├─ VALIDATION_TOO_SHORT
  ├─ VALIDATION_TOO_LONG
  └─ VALIDATION_INVALID_UUID

*_NOT_FOUND (404)
  ├─ NOTE_NOT_FOUND
  ├─ CLUSTER_NOT_FOUND
  └─ EMBEDDING_NOT_FOUND

*_FAILED (400/500)
  ├─ NOTE_CREATE_FAILED
  ├─ NOTE_UPDATE_FAILED
  └─ SEARCH_FAILED

その他
  ├─ BATCH_LIMIT_EXCEEDED (400)
  └─ INTERNAL (500)
```

---

## 8. 主要ワークフロー

### 8.1 ノート作成フロー

```
POST /api/notes { title, content }
  ↓
noteDispatcher.create()
  ↓
notesService.createNote(title, content)
  ├─ ① DB に note を挿入（metadata抽出）
  ├─ ② FTS5 に同期
  ├─ ③ IDFキャッシュを無効化
  ├─ ④ NOTE_ANALYZE ジョブをキューに追加
  │   └─ (async) Embedding生成 → Relations構築
  └─ ⑤ inferAndSave() を非同期実行
      ├─ ノートタイプ推論
      ├─ 昇格候補検出
      └─ レビュースケジュール自動追加
  ↓
return { id, title, content, ... }
```

### 8.2 検索フロー

```
GET /api/search?query=...&mode=...
  ↓
searchRoute handler
  ├─ mode = "semantic"?
  │   └─ searchNotesSemantic(query)
  │       ├─ generateEmbedding(query) → MiniLM
  │       └─ searchSimilarHNSW(embedding, topk=20)
  │
  ├─ mode = "hybrid"?
  │   ├─ searchNotes(query) // キーワード
  │   ├─ searchNotesSemantic(query) // セマンティック
  │   └─ mergeSearchResults() // 60:40で統合
  │
  └─ デフォルト: searchNotes(query)
      ├─ FTS5検索
      ├─ TF-IDFスコア計算
      └─ スコア順にソート
```

### 8.3 Spaced Reviewフロー

```
GET /api/review/queue → getDueReviewItems()
  ↓
POST /api/review/start { noteId } → startReview()
  ↓
POST /api/review/submit { scheduleId, quality }
  ↓
submitReviewResult()
  ├─ calculateSM2(quality) で EF・interval 計算
  ├─ updateScheduleAfterReview() で DB 更新
  └─ 次回予定を設定
```

### 8.4 クラスタ再構築フロー

```
POST /api/v1 { action: "cluster.rebuild" }
  ↓
enqueueJob("CLUSTER_REBUILD", payload)
  ↓
Job Queue処理
  ├─ getAllEmbeddings()
  ├─ K-Means クラスタリング (k=8)
  ├─ cluster_history に記録
  ├─ notes.clusterId を更新
  ├─ cluster_dynamics スナップショット作成
  └─ concept_graph_edges 構築
```

---

## 9. v4 Decision-First アーキテクチャ

### 9.1 ノート分類

| タイプ | 説明 | 例 |
|--------|------|-----|
| **decision** | 判断・決定 | 「〜を採用する」「〜にする」 |
| **learning** | 学習・知識 | 「〜とは」「〜の方法」 |
| **scratch** | メモ・下書き | 一時的なアイデア |
| **emotion** | 感情・所感 | 「〜と感じた」 |
| **log** | ログ・記録 | 日付ベースの記録 |

### 9.2 時間減衰（Decay）モデル

```
effective_confidence = confidence × e^(-λt)

DecayProfile別:
├─ stable: λ=0.001, 半減期≈693日（アーキテクチャ原則）
├─ exploratory: λ=0.01, 半減期≈69日（技術選定の試行）
└─ situational: λ=0.05, 半減期≈14日（その場の判断）
```

### 9.3 昇格候補検出

- confidenceが閾値に近づいた
- 同じノートが複数回更新された
- 特定パターンにマッチ

→ promotion_notifications テーブルに挿入

### 9.4 反証ログ

| タイプ | 説明 |
|--------|------|
| regret | 後悔・やり直したい点 |
| missed_alternative | 見落とした選択肢 |
| unexpected_outcome | 予想外の結果 |
| contradiction | 矛盾する判断 |

---

## 10. v4.5 Spaced Review + Active Recall

### 10.1 SM-2アルゴリズム

```
EF (Easiness Factor) = EF - (5 - Q) × 0.1
EF = max(1.3, EF)

I (Interval)計算:
├─ 1回目: I = 1
├─ 2回目: I = 3
└─ 3回目以降: I = I × EF

状態遷移:
├─ Q < 3: リセット（新規に戻る）
├─ Q >= 3: 間隔を計算して次回予定
```

### 10.2 質問タイプ

| タイプ | 説明 |
|--------|------|
| recall | 「このノートの主なポイントは？」 |
| concept | 「〜とは何ですか？」 |
| reasoning | 「なぜ〜なのですか？」 |
| application | 「〜の場合、どうしますか？」 |
| comparison | 「AとBの違いは？」 |

---

## 11. キャッシュ戦略

### 11.1 IDFキャッシュ（メモリ内）

```
buildIDFCache()
  └─ 全ノートをスキャン → docFreq計算 → IDF値計算

getIDFCache()
  └─ キャッシュがなければ構築

invalidateIDFCache()
  └─ ノートのCRUD時に無効化（Write-through方式）
```

### 11.2 HNSWインデックス（メモリ内）

```
addToIndex(noteId, embedding)
searchSimilarHNSW(query_embedding, topk)
buildIndex() - 全embeddingを再インデックス
```

---

## 12. パフォーマンス指標

| 項目 | 目安 |
|------|------|
| ノート作成 | < 500ms（Embedding非同期） |
| ノート更新 | < 500ms（推論非同期） |
| キーワード検索 | < 200ms（1000ノート） |
| セマンティック検索 | < 1000ms（1000ノート） |
| クラスタ再構築 | 1-5分（ノード数に依存） |
| Embedding生成 | 100-500ms/ノート |
| メモリ使用量 | 500MB〜2GB |

---

## 13. ディレクトリ構造

```
brain-cabinet/
├── src/
│   ├── index.ts                 # メインエントリーポイント
│   ├── db/
│   │   ├── client.ts            # DB接続
│   │   └── schema.ts            # スキーマ定義
│   ├── repositories/            # データ永続化層
│   ├── services/                # ビジネスロジック層
│   │   ├── notesService/
│   │   ├── searchService/
│   │   ├── embeddingService/
│   │   ├── cluster/
│   │   ├── drift/
│   │   ├── ptm/
│   │   ├── influence/
│   │   ├── inference/
│   │   ├── decision/
│   │   ├── review/
│   │   ├── promotion/
│   │   ├── counterevidence/
│   │   ├── analytics/
│   │   ├── gptService/
│   │   └── jobs/
│   ├── dispatchers/             # コマンドディスパッチ
│   ├── routes/                  # APIルート
│   ├── utils/                   # ユーティリティ
│   ├── types/                   # 型定義
│   ├── scripts/                 # バッチスクリプト
│   ├── checker/                 # 整合性チェック
│   ├── importer/                # ノートインポート
│   ├── exporter/                # ノートエクスポート
│   └── syncer/                  # ノート同期
├── drizzle/                     # マイグレーション
├── docs/                        # ドキュメント
├── notes/                       # ノート保管
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

---

## 14. 運用コマンド

```bash
# 開発
npm run dev              # 開発サーバー起動
npm run test             # テスト実行
npm run test:watch       # テスト監視モード

# データベース
npm run migrate          # マイグレーション

# 初期化
npm run init-fts         # FTS5インデックス初期化
npm run init-embeddings  # Embedding初期化

# データ操作
npm run import-notes     # ノートインポート
npm run export-notes     # ノートエクスポート
npm run sync-notes       # ノート同期
npm run integrity-check  # 整合性チェック
```

---

## 15. 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript 5.3 |
| ランタイム | Node.js |
| フレームワーク | Hono 4.0 |
| ORM | Drizzle ORM 0.44 |
| データベース | SQLite |
| テスト | Vitest 4.0 |
| ログ | Pino 10.1 |
| AI/ML | MiniLM (@xenova/transformers) |
| ベクトル検索 | hnswlib-node 3.0 |
| クラスタリング | ml-kmeans 7.0 |
| OpenAI | openai 6.9 |
