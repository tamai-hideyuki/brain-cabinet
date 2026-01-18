# Brain Cabinet - 機能概要

**個人の思考を構造化し、AIと連携して成長を支援する統合知識管理システム**

**v7.1.0**

---

## コンセプト

Brain Cabinetは単なるメモアプリではなく、個人の思考を構造的に管理し、ローカルLLMやGPTと連携して知識の整理・振り返り・成長を支援するシステムです。すべてのデータはローカルのSQLiteに保存され、完全オフラインで動作します。

---

## 主要機能

### 1. ノート管理

| 機能 | 説明 |
|------|------|
| 作成・編集・削除 | Markdownベースのノート管理 |
| 履歴管理 | 変更履歴の追跡、任意のバージョンへのロールバック |
| 画像埋め込み | ドラッグ&ドロップでノートに画像を直接埋め込み |
| ソフトデリート | 削除したノートの復元が可能 |
| 一括操作 | 複数ノートの一括削除・カテゴリ変更 |
| 視点タグ | engineer/po/user/cto/team/stakeholder |

### 2. 高度な検索

| モード | 説明 |
|--------|------|
| キーワード検索 | FTS5による全文検索 |
| セマンティック検索 | Embedding（MiniLM）による意味的検索 |
| ハイブリッド検索 | キーワード + セマンティックの組み合わせ |

### 3. 自動分類（判断ファースト）

ノートは以下の5つのタイプに自動分類されます：

| タイプ | 説明 |
|--------|------|
| `decision` | 意思決定・判断 |
| `learning` | 学習・知識 |
| `scratch` | 一時的メモ |
| `emotion` | 感情・気持ち |
| `log` | 事実記録 |

**Intent（関心領域）分類**:
- architecture, design, implementation, review, process, people, unknown

### 4. クラスタリング

- **K-Means**: Embeddingベースの自動トピック分類
- **Temporal Clustering (v7)**: 思考系譜の時系列追跡
  - クラスタの分裂・統合・消滅・出現イベント検出
  - クラスタ継承関係の追跡（lineage）
  - 論理クラスタID（clusterIdentities）による永続識別
  - 思考の進化を可視化

### 5. Spaced Review（間隔反復学習）

| 機能 | 説明 |
|------|------|
| SM-2アルゴリズム | 最適なタイミングでレビューをスケジュール |
| Active Recall | 自動生成された質問で想起練習 |
| レビューセッション | 品質評価に基づく次回間隔の自動調整 |

### 6. ブックマーク

階層構造で参照を管理：
- **フォルダ**: 整理用の入れ物
- **ノート参照**: 既存ノートへのショートカット
- **外部リンク**: URLの保存
- **3D空間位置**: libraryPosition/libraryColor（実験的）

### 7. シークレットBOX

画像・動画・PDFを安全に保存：
- ドラッグ&ドロップでアップロード
- サムネイル自動生成
- フォルダ整理

### 8. コーチング機能

苫米地式コーチングに基づくセッション：
- **goal_setting**: 目標設定
- **abstraction**: 抽象化
- **self_talk**: セルフトーク
- **integration**: 統合

### 9. ポモドーロタイマー

- セッション履歴の記録
- タイマー状態管理

### 10. Voice Evaluation（v7.3）

観測者ルールに基づくノート評価：
- ルール別スコアリング
- フィードバック生成

---

## UI画面構成

| 画面 | 説明 |
|------|------|
| **Dashboard** | 今日のスナップショット、活動概要、レビュー待ち、昇格候補を1画面に集約 |
| **Notes** | ノート一覧、フィルタリング、検索、ページネーション |
| **Note Detail** | ノート詳細表示、編集、履歴 |
| **Reviews** | レビュー対象ノート、スケジュール管理 |
| **Graph** | ノート間の影響関係をネットワークグラフで可視化 |
| **Timeline** | 時系列でのノート更新追跡 |
| **Cluster Evolution** | クラスタの時系列変化、分裂・統合イベント |
| **Bookmark** | ブックマーク階層構造管理 |
| **Secret Box** | メディアファイル管理 |
| **Library** | 3D空間でノートを探索（実験的） |
| **Coaching** | コーチングセッション |
| **System** | ジョブ状態、ストレージ統計 |

---

## GPT/AI連携

### ローカルLLM推論（v6）

**Ollama + Qwen2.5:3b** によるローカル推論（APIコストゼロ）

```
ノート保存 → LLM推論 → 結果保存
              ↓
        confidence 判定
        ├─ >= 0.85: 自動反映
        ├─ 0.7-0.85: 週次通知
        └─ < 0.7: 保留（手動確認）
```

推論内容：
- ノートタイプ（decision/learning/scratch/emotion/log）
- Intent（関心領域）
- Confidence（確信度）
- Reasoning（推論理由）

### GPT Actions連携

GPT（ChatGPT等）からBrain Cabinetにアクセス可能：

| コマンド | 説明 |
|----------|------|
| `gpt.search` | ハイブリッド検索（GPT向け最適化） |
| `gpt.context` | ノート詳細コンテキスト取得 |
| `gpt.coachDecision` | 過去の判断を参照した意思決定支援 |
| `gpt.overview` | 統計情報の取得 |
| `gpt.task` | タスク推奨 |

### 思考分析AI

| 機能 | 説明 |
|------|------|
| **PTM (Personal Thinking Model)** | 個人の思考パターンをモデル化 |
| **Drift分析** | 思考活動の偏り・異常を検出 |
| **Influence分析** | ノート間の因果関係を推定 |
| **Isolation検出** | 孤立したノートを発見、統合を提案 |
| **Semantic Change検出** | ノートの意味的変化を追跡 |

---

## データ構造

### テーブル概要（全38テーブル）

| カテゴリ | テーブル数 | 主要テーブル |
|----------|-----------|--------------|
| コア | 5 | notes, noteHistory, noteEmbeddings, noteRelations, noteImages |
| クラスタリング（Legacy） | 3 | clusters, clusterHistory, clusterDynamics |
| Temporal Clustering (v7) | 6 | clusteringSnapshots, snapshotClusters, clusterLineage, clusterEvents, clusterIdentities, snapshotNoteAssignments |
| グラフ & 分析 | 6 | conceptGraphEdges, noteInfluenceEdges, driftEvents, driftAnnotations, metricsTimeSeries, analysisCache |
| 推論 & 判断 | 4 | noteInferences, llmInferenceResults, promotionNotifications, decisionCounterevidences |
| Spaced Review | 3 | reviewSchedules, recallQuestions, reviewSessions |
| ワークフロー & ジョブ | 3 | workflowStatus, jobStatuses, ptmSnapshots |
| ブックマーク & Secret Box | 3 | bookmarkNodes, secretBoxFolders, secretBoxItems |
| コーチング | 2 | coachingSessions, coachingMessages |
| ポモドーロ | 2 | pomodoroSessions, pomodoroTimerState |
| Voice Evaluation | 1 | voiceEvaluationLogs |

---

## API設計

単一エンドポイント `/api/v1` による統合API：

```json
POST /api/v1
{
  "action": "domain.command",
  "payload": { ... }
}
```

### 主要ドメイン（21ディスパッチャー）

| ドメイン | コマンド例 |
|----------|-----------|
| `note` | create, get, update, delete, list, history |
| `search` | query, categories, byTitle |
| `cluster` | list, get, rebuild |
| `clusterDynamics` | get |
| `review` | queue, start, submit, schedule |
| `llmInference` | run, get, list |
| `gpt` | search, context, coachDecision |
| `ptm` | latest, history |
| `drift` | getTimeline, getState |
| `influence` | graph, topInfluencers |
| `insight` | overview, growth |
| `analytics` | summary |
| `bookmark` | list, create, update, delete |
| `isolation` | detect, list |
| `coaching` | start, message, end |
| `promotion` | getCandidates, dismiss, promote |
| `decision` | search, context, compare |
| `rag` | query |
| `system` | health, embed, rebuildFts |
| `job` | getStatus, list |
| `workflow` | reconstruct |

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript 100% |
| サーバー | Hono |
| UI | React + Vite |
| データベース | SQLite (Drizzle ORM) |
| 検索 | FTS5 + MiniLM Embedding |
| LLM推論 | Ollama / OpenAI API |
| 日本語処理 | TinySegmenter |

---

## バージョン履歴

| バージョン | 主要機能 |
|------------|----------|
| v4 | 判断ファースト（ノートタイプ分類、Intent） |
| v4.5 | Spaced Review + Active Recall |
| v5 | ブックマーク、シークレットBOX |
| v5.6 | セマンティック変化検出 |
| v6 | ローカルLLM推論（Ollama統合） |
| v7 | Temporal Clustering（思考系譜追跡） |
| v7.1 | コーチング機能、ポモドーロタイマー |
| v7.3 | Voice Evaluation（観測者ルール評価） |

---

## 特徴

1. **完全ローカル動作**: すべてのデータはSQLiteに保存、オフラインで動作
2. **APIコストゼロ**: ローカルLLM（Ollama）による推論
3. **統一API設計**: 21ディスパッチャー、100+のアクションを単一エンドポイントで提供
4. **多面的分析**: PTM/Drift/Influence/Isolation/SemanticChangeなど複数の分析レンズ
5. **学習支援**: Spaced Review + Active Recallで知識定着を強化
6. **思考の可視化**: ネットワークグラフ、タイムライン、クラスタ進化
7. **コーチング統合**: 苫米地式コーチングによる目標達成支援

---

*最終更新: 2026-01-19*
