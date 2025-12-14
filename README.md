# Brain Cabinet v4.8.0 (Decision-First + Spaced Review)

**思考ベースの検索型知識システム — あなたの思考を理解し、成長を見守る外部脳**

> Brain Cabinet は単なるメモ帳ではありません。
> ノートの**文脈を理解**し、質問に応じて**必要な部分だけを抽出・再構成**する仕組みです。
>
> **v4.5 の新機能: Spaced Review + Active Recall**
> - **SM-2アルゴリズム**による間隔反復で最適なタイミングでレビュー
> - **Active Recall**でノートから自動生成された質問に答えて定着強化
> - learning/decision ノートを自動でレビュースケジュールに追加
>
> **v4 の革新: Decision-First アーキテクチャ**
> - ノートは自動的に**タイプ分類**（decision/learning/scratch/emotion/log）
> - **判断ノートを優先表示** — 過去の意思決定をすぐに参照可能
> - **メタデータはシステムが推論** — ユーザーの負担ゼロ
>
> v3.0 では**PTM（Personal Thinking Model）**、**Drift分析**、**Influence Graph**、**Cluster Dynamics**、**クラスタ人格化エンジン**を搭載。
> **統合Command API**により、GPT Actionsから全機能にアクセス可能。

---

## なぜ Brain Cabinet なのか？

従来のメモアプリは「保存」と「検索」だけ。Brain Cabinet は違います：

| 従来のメモアプリ | Brain Cabinet v4 |
|----------------|------------------|
| キーワード一致で検索 | **意味を理解**して関連ノートを発見 |
| タグは手動で付ける | **自動でタイプ分類**（decision/learning/scratch） |
| 全ノートが同列 | **判断ノートを優先表示**（Decision-First） |
| 検索結果は羅列 | **TF-IDF + 構造スコア**で最適順に |
| 履歴なし | **Semantic Diff**で思考の変化率を追跡 |
| 単体で完結 | **GPT/Claude と連携**して外部脳化 |
| 整理は手動 | **K-Means クラスタリング**で自動分類 |
| 振り返りは困難 | **PTM Snapshot**で思考モデルを可視化 |
| 成長が見えない | **Drift分析**で成長角度・予測を提供 |
| 知識の関連が不明 | **Influence Graph**で概念の影響関係を追跡 |
| 質問への回答が困難 | **RAG**でノートを参照して質問に回答 |
| 過去の判断を忘れる | **判断コーチング**で過去の判断を参照 |
| 学んでも忘れる | **Spaced Review + Active Recall**で定着強化 |

---

## 主な特徴

### 1. Decision-First アーキテクチャ（v4 新機能）

**「メタデータは人間が書くものではなく、システムが推論するもの」**

ノートを保存すると、システムが自動的にタイプを分類：

```
┌─────────────────────────────────────────────────────────────┐
│                     Note Inference Engine                    │
├─────────────────────────────────────────────────────────────┤
│  Input: ノート本文                                            │
│  ↓                                                           │
│  Rule-based Classification (パターンマッチング)              │
│  ↓                                                           │
│  Output: type, intent, confidence, reasoning                 │
└─────────────────────────────────────────────────────────────┘
```

**ノートタイプ（自動分類）:**

| タイプ | 説明 | 検索優先度 |
|-------|------|----------|
| `decision` | 意思決定・判断の記録 | **最高**（100） |
| `learning` | 学習内容・知識の定着 | 高（80） |
| `scratch` | 一時的なメモ・下書き | 中（50） |
| `emotion` | 感情・気持ちの記録 | 低（30） |
| `log` | 日次ログ・記録 | 低（30） |

**意図カテゴリ（intent）:**

| Intent | 説明 |
|--------|------|
| `architecture` | 設計・アーキテクチャに関する判断 |
| `design` | UIや体験設計に関する判断 |
| `implementation` | 実装方法に関する判断 |
| `review` | 振り返り・評価 |
| `process` | プロセス・ワークフローに関する判断 |
| `people` | 人間関係・チームに関する判断 |
| `unknown` | 分類不明 |

**Decision-First API:**

| アクション | 説明 |
|-----------|------|
| `decision.search` | 過去の判断ノートを検索 |
| `decision.context` | 判断の詳細（関連learning/scratch含む） |
| `decision.compare` | 複数の判断を時系列で比較 |
| `decision.promotionCandidates` | 昇格候補のscratchノート |
| `gpt.coachDecision` | 判断コーチング（過去の判断を参照） |

### 2. 統合 Command API

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

### 3. 三層検索システム

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

### 4. PTM（Personal Thinking Model）Snapshot Engine

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

### 5. Drift分析

思考の「成長角度」を可視化：

- **Timeline**: 日次Drift値とEMA（指数移動平均）
- **Growth Angle**: 成長の方向と速度（角度・トレンド）
- **Forecast**: 3日後・7日後の成長予測
- **Warning**: 過熱・停滞の自動検出とアドバイス

### 6. Influence Graph

ノート間の「影響関係」を追跡：

- **Influencers**: このノートに影響を与えているノート
- **Influenced**: このノートが影響を与えているノート
- **Stats**: 総エッジ数、平均影響度、トップ影響ノート

### 7. Cluster Dynamics

クラスタの「動態」を分析：

- **Cohesion**: 凝集度（クラスタの密度）
- **Stability**: 安定性スコア（変化の大きさ）
- **Interactions**: クラスタ間の関係性マトリクス
- **Timeline**: クラスタ別の時系列変化

### 8. クラスタ人格化エンジン

各クラスタに「人格」を付与：

- **Identity**: 凝集度・安定性・代表ノートから生成
- **Representatives**: 重心に最も近い代表ノートTop N
- **GPT向けフォーマット**: システムプロンプト付きで出力

### 9. RAG（質問応答）

ノートを参照して質問に回答：

```
┌─────────────────────────────────────────────────────────────┐
│                      rag.context                             │
├─────────────────────────────────────────────────────────────┤
│  Input          │ question: 質問文                          │
│  Processing     │ セマンティック検索で関連ノートを取得        │
│  Output         │ 関連ノートのコンテキスト + GPTへの指示文    │
└─────────────────────────────────────────────────────────────┘
```

- **方式B（GPT Actions委譲）**: LLM呼び出しはGPT側で行う（追加API費用なし）
- **セマンティック検索**: 質問に意味的に関連するノートを取得
- **コンテキスト構築**: ノートの内容・関連度・カテゴリを返す
- **limit調整可能**: デフォルト5件、パラメータで変更可能

### 10. Workflow（一括再構築）

思考分析システム全体を一括で再構築：

- **workflow.reconstruct**: Embedding → クラスタ → FTS → Drift → Influence → PTM を順次実行
- **workflow.status**: 再構築の進捗状況をリアルタイムで確認
- **バックグラウンド実行**: 非同期ジョブで大量データも処理可能
- **データ不整合の修復**: 定期メンテナンスやトラブルシューティングに有用

### 11. Spaced Review + Active Recall（v4.5 新機能）

学習の定着を加速するための間隔反復と能動的想起を統合：

```
┌─────────────────────────────────────────────────────────────┐
│                    Spaced Review Engine                      │
├─────────────────────────────────────────────────────────────┤
│  SM-2 Algorithm    │ 最適タイミングでレビューをスケジュール    │
│  Active Recall     │ ノートから質問を自動生成                 │
│  Auto-Schedule     │ learning/decision ノートを自動追加       │
│  Progress Track    │ EF・間隔・連続正解を記録                 │
└─────────────────────────────────────────────────────────────┘
```

**SM-2 品質評価（0-5）:**

| 値 | 意味 | 次回への影響 |
|----|------|-------------|
| 0-2 | 不正解 | リセット（1日後） |
| 3 | 正解（困難） | 間隔維持〜微増 |
| 4 | 正解（少し躊躇） | 間隔拡大 |
| 5 | 完璧 | 間隔大幅拡大 |

**質問タイプ:**

| タイプ | 用途 |
|--------|------|
| `recall` | 「このノートの主なポイントを3つ挙げてください」 |
| `concept` | 「{topic}とは何ですか？」 |
| `reasoning` | 「この判断の根拠は何ですか？」（decision用） |
| `application` | 「この知識をどのような場面で活用できますか？」 |

**Spaced Review API:**

| アクション | 説明 |
|-----------|------|
| `review.queue` | レビュー待ちキューを取得 |
| `review.list` | 期間別にグルーピングしたリストを取得 |
| `review.start` | レビューセッションを開始 |
| `review.submit` | レビュー結果を送信（SM-2で次回計算） |
| `review.schedule` | 手動でレビューをスケジュール（force: trueで任意のノートを追加可能） |
| `review.cancel` | レビューをキャンセル（リストから外す） |
| `review.stats` | ノート別のレビュー統計 |
| `review.overview` | 全体のレビュー統計 |

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
| `gpt.coachDecision` | 判断コーチング | `{query}` |

#### Decision ドメイン（v4 新規）
| アクション | 説明 | payload |
|-----------|------|---------|
| `decision.search` | 判断ノートを検索 | `{query, intent?, minConfidence?}` |
| `decision.context` | 判断の詳細コンテキスト | `{noteId}` |
| `decision.promotionCandidates` | 昇格候補一覧 | `{limit?}` |

#### Review ドメイン（v4.5 新規）
| アクション | 説明 | payload |
|-----------|------|---------|
| `review.queue` | レビュー待ちキュー取得 | `{limit?}` |
| `review.list` | 期間別にグルーピングしたリスト取得 | - |
| `review.start` | レビューセッション開始 | `{noteId}` |
| `review.submit` | レビュー結果送信 | `{scheduleId, quality, responseTimeMs?, questionsAttempted?, questionsCorrect?}` |
| `review.schedule` | 手動でスケジュール | `{noteId, force?}` |
| `review.cancel` | レビューキャンセル | `{noteId}` |
| `review.reschedule` | 再スケジュール | `{noteId, daysFromNow}` |
| `review.questions` | 質問一覧取得 | `{noteId}` |
| `review.regenerateQuestions` | 質問再生成 | `{noteId}` |
| `review.stats` | ノート別統計 | `{noteId}` |
| `review.overview` | 全体統計 | - |
| `review.fixRevision` | レビュー対象バージョンを固定 | `{noteId, historyId}` |
| `review.unfixRevision` | バージョン固定を解除 | `{noteId}` |

#### RAG ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `rag.context` | 質問に関連するノートのコンテキスト取得 | `{question, limit?}` |

#### Workflow ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `workflow.reconstruct` | 思考分析システム全体を再構築 | - |
| `workflow.status` | 再構築の進捗状況を取得 | - |

#### System ドメイン
| アクション | 説明 | payload |
|-----------|------|---------|
| `system.health` | ヘルスチェック | - |
| `system.embed` | テキスト埋め込み | `{text}` |
| `system.rebuildFts` | FTSインデックス再構築 | - |

### プロンプト例とAPI対応表

#### 判断・意思決定（v4 推奨）

| やりたいこと | GPTへのプロンプト例 | 呼び出されるaction |
|------------|-------------------|-------------------|
| 過去の判断を検索 | 「アーキテクチャに関する過去の判断を探して」 | `decision.search` |
| 判断の詳細 | 「この判断の詳細と関連する学習を見せて」 | `decision.context` |
| 判断コーチング | 「TypeScriptとRustどちらを選ぶべきか迷ってる」 | `gpt.coachDecision` |
| 昇格候補 | 「判断に昇格できそうなメモはある？」 | `decision.promotionCandidates` |

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

#### 判断に迷ったとき（v4 推奨）
```
新しいプロジェクトでTypeScriptとRust、どちらを選ぶべきか迷ってる。
過去の判断を参考にアドバイスして。
```
→ `gpt.coachDecision`

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

#### RAG質問応答
```
TypeScriptの型ガードについて、私のノートを参照して教えて。
```
→ `rag.context`

#### システム再構築
```
思考分析システム全体を再構築して。進捗も教えて。
```
→ `workflow.reconstruct` → `workflow.status`

#### 学習レビュー（v4.5 新規）

| やりたいこと | GPTへのプロンプト例 | 呼び出されるaction |
|------------|-------------------|-------------------|
| レビュー待ち確認 | 「今日のレビュー待ちを見せて」 | `review.queue` |
| リキャップリスト | 「リキャップリストを見せて」 | `review.list` |
| リストに追加 | 「このノートをリキャップリストに入れて」 | `review.schedule` (force: true) |
| リストから外す | 「このノートをリキャップリストから外して」 | `review.cancel` |
| レビュー開始 | 「このノートをレビューしたい」 | `review.start` |
| レビュー統計 | 「レビューの全体統計を教えて」 | `review.overview` |
| ノート別統計 | 「このノートのレビュー履歴を見せて」 | `review.stats` |

```
今日復習すべきノートはある？レビュー待ちを確認して。
```
→ `review.queue`

```
TypeScriptの型システムについてのノートをレビューしたい。質問を出して。
```
→ `review.start`

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
│   │   ├── workflowDispatcher.ts
│   │   ├── ragDispatcher.ts
│   │   ├── decisionDispatcher.ts  # v4 新規
│   │   ├── reviewDispatcher.ts    # v4.5 新規
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

### Phase 3.2/3.3（v3.3 完了）
- [x] **RAG（質問応答）** - ノートを参照して質問に回答
- [x] **Workflow API** - 思考分析システム一括再構築
- [x] **workflow.status** - 再構築進捗のリアルタイム確認
- [x] **cluster.list GPT最適化** - centroid除外でGPT解釈改善
- [x] **cluster-worker修正** - ワークフローステータス更新バグ修正

### Phase 4（v4.0 完了）
- [x] **Decision-First アーキテクチャ** - 判断ノートを優先表示
- [x] **自動タイプ分類** - decision/learning/scratch/emotion/log
- [x] **Note Inference Engine** - ルールベースのノート分類
- [x] **`note_inferences` テーブル** - 推論結果の永続化
- [x] **Decision API** - search, context, promotionCandidates
- [x] **判断コーチング** - `gpt.coachDecision` で過去の判断を参照

### Phase 4.5（v4.5 完了）
- [x] **Spaced Review + Active Recall** - 間隔反復と能動的想起の統合
- [x] **SM-2 アルゴリズム** - 最適タイミングでレビューをスケジュール
- [x] **Active Recall 質問生成** - テンプレートベースの質問自動生成
- [x] **Auto-Schedule** - learning/decision ノートを自動でスケジュール
- [x] **Review API** - queue, list, start, submit, schedule (force対応), cancel, reschedule, questions, regenerateQuestions, stats, overview

### Phase 5（予定）
- [ ] LLM 推論統合（GPT-4 によるタイプ分類）
- [ ] 要約生成・保存
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
| `workflow` | reconstruct, status（クラスタ/Embedding/FTS再構築） |
| `gpt` | search, context, task, overview |
| `rag` | context（質問応答） |

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

### v4.8.0
- **Fixed Revision for Review（レビューバージョン固定）**: レビュー対象のノートバージョンを固定する機能
  - `fixedRevisionId` カラムを `review_schedules` テーブルに追加
  - `review.fixRevision` API: 指定した履歴（`note_history.id`）でレビューコンテンツを固定
  - `review.unfixRevision` API: 固定を解除して常に最新版でレビュー
  - `review.start` 拡張: `fixedRevisionId` と `contentSource` ("latest" | "fixed") をレスポンスに追加
  - **ユースケース**: ノートが更新されても、特定バージョンの内容でレビューを継続したい場合
  - **設計思想**: 「参照すべき更新番号をメモっておいて、リキャップ対象をそれに固定」をDBレベルで実現
- **ER図更新**: `docs/er-diagram.md` に `fixedRevisionId` と `noteHistory` への関係を追加

### v4.7.0
- **note.history 改善**: ページネーション＆軽量モード対応
  - `limit`, `offset`, `includeContent` パラメータ追加
  - `contentLength` フィールド追加（差分サイズ比較用）
  - `historyId` 指定で特定履歴を1件取得可能
- **note.revert**: 過去のバージョンにメモを復元
- **GPT Actions 保護強化**: `note.update`, `note.delete` にユーザー明示的指示が必要な旨を明記
- **タイムスタンプ解釈ガイド追加**: UNIX timestamp を JST として正しく解釈するよう明記

### v4.6.0
- **workflow.reconstruct に推論ステップ追加**: 全ノートの type/intent 推論を実行
  - `inferences` ステップを追加（Step 1 として実行）
  - `note_inferences` テーブルに全ノートの推論結果を登録
  - Spaced Review の `review.schedule` が正常に動作するための前提条件を自動整備
- **エラーログ改善**: コマンド実行エラー時に `message`, `stack`, `cause` を出力
- **WorkflowProgress 型拡張**: `inferences` ステップを追加

### v4.5.0
- **Spaced Review + Active Recall**: 間隔反復と能動的想起を統合した学習定着機能
  - **SM-2 アルゴリズム**: 品質評価（0-5）に基づき最適なタイミングでレビューをスケジュール
  - **Active Recall 質問生成**: テンプレートベースでノートから質問を自動生成
  - **Auto-Schedule**: learning/decision タイプのノートを自動でレビュー対象に追加
  - **Review API**: queue, list, start, submit, schedule (force対応), cancel, reschedule, questions, regenerateQuestions, stats, overview
  - **質問タイプ**: recall, concept, reasoning, application, comparison
  - **テーブル追加**: `review_schedules`, `recall_questions`, `review_sessions`
  - **設計原則**: 自動スケジュールするが、レビュー実施は人間が決める

### v4.4.0
- **Counterevidence Log（反証ログ）**: 判断の失敗を資産化する機能
  - `decision_counterevidences` テーブル: 反証の永続化
  - 反証タイプ: `regret`（後悔）/ `missed_alternative`（見落とし）/ `unexpected_outcome`（予想外）/ `contradiction`（矛盾）
  - 深刻度: `minor` / `major` / `critical`（数値 + ラベルの両方を保持）
  - `decision.addCounterevidence` API: 反証を追加
  - `decision.getCounterevidences` API: 反証一覧を取得
  - `decision.deleteCounterevidence` API: 反証を削除
  - `decision.context` 拡張: `counterevidence` + `counterevidenceSummary` を追加
  - **コンセプト**: 「失敗も資産化」「思考の免疫システム」

### v4.3.1
- **decision.compare**: 複数の判断を比較用に並べて取得
  - 同じトピックについて過去に下した判断を時系列で並べ、思考の変遷を振り返る
  - `compareDecisions(query, options)`: searchDecisions を流用し、createdAt 順にソート
  - 比較用は低めの閾値（minConfidence: 0.3）をデフォルトに
  - **コンセプト**: 「昔の自分同士をディベートさせる」

### v4.3.0
- **Promotion Notifications（昇格通知）**: scratch ノートの昇格候補を自動検出・提案
  - `promotion_notifications` テーブル: 通知の永続化
  - `checkPromotionTriggers`: ノート保存時に昇格候補を検出（confidence ≥ 0.55）
  - `promotion.pending` API: 未対応の昇格通知一覧を取得
  - `promotion.dismiss/accept` API: 却下/昇格実行
  - スパム防止: 同一ノート・トリガーで pending 通知がある場合は重複作成しない
  - **設計原則**: 自動昇格しない。検出して提案するだけ。決めるのは人間。

### v4.2.0
- **Time Decay（時間減衰）**: 判断の鮮度を自動計算、検索スコアに反映
  - `DecayProfile`: stable（半減期693日）/ exploratory（69日）/ situational（14日）
  - `effectiveScore = similarity * confidence * timeDecayFactor`
  - stable な判断は最低 0.5 を保証（設計原則が完全に消えるのを防ぐ）
- **`note_inferences` テーブル拡張**: `decay_profile` カラム追加
- **inferDecayProfile**: パターンマッチングでプロファイルを自動推論
  - 「当面は」「一旦」「試しに」→ situational
  - 「原則」「基本方針」「常に」→ stable
  - Intent と confidence による fallback ルール
- **API拡張**: `decision.search` レスポンスに `decayProfile`, `effectiveScore`, `createdAt` 追加

### v4.1.0
- **Confidence Detail（信頼度分解）**: 単一の `confidence` を3要素に分解
  - `structural`: 構文パターン（言い切り・比較・断定）
  - `experiential`: 経験ベース（過去の判断との類似度）※将来拡張
  - `temporal`: 時間ベース（直近・繰り返し）※将来拡張
- **`note_inferences` テーブル拡張**: `confidence_detail` カラム追加（JSON）
- **後方互換性維持**: 総合 `confidence` は引き続き提供

### v4.0.0 (Phase 4 完了)
- **Decision-First アーキテクチャ**: 判断ノートを検索で優先表示
- **自動タイプ分類**: ノート保存時に decision/learning/scratch/emotion/log を自動分類
- **Note Inference Engine**: ルールベースの分類エンジン（confidence 最大 0.6）
- **`note_inferences` テーブル**: 推論結果の永続化
- **Decision API**: `decision.search`, `decision.context`, `decision.promotionCandidates`
- **判断コーチング**: `gpt.coachDecision` で過去の判断を参照してアドバイス
- **Intent カテゴリ**: architecture, design, implementation, review, process, people, unknown
- **OpenAPI v4 更新**: Decision API を追加、GPT向けガイド更新

### v3.3.2
- **cluster-worker修正**: ワークフローステータス更新バグ修正（getLatestWorkflowStatus使用）

### v3.3.1
- **cluster.list GPT最適化**: centroid（384次元ベクトル）を除外してGPT解釈改善

### v3.3.0
- **workflow.status API**: 再構築の進捗状況をリアルタイムで確認

### v3.2.0
- **RAG（質問応答）**: ノートを参照して質問に回答、方式B（GPT Actions委譲）で追加API費用なし
- **Workflow API**: 思考分析システム全体の一括再構築（Embedding → クラスタ → FTS → Drift → Influence → PTM）

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

**Brain Cabinet v4.8 (Decision-First + Spaced Review)** — Your External Brain that Remembers Your Decisions and Helps You Learn
