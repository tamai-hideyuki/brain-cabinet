# Brain Cabinet - 機能概要

**個人の思考を構造化し、AIと連携して成長を支援する統合知識管理システム**

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
| 一括操作 | 複数ノートの一括削除・カテゴリ変更 |

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
  - クラスタの分裂・統合・消滅イベント検出
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

### 7. シークレットBOX

画像・動画・PDFを安全に保存：
- ドラッグ&ドロップでアップロード
- サムネイル自動生成
- フォルダ整理

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
| **System** | ジョブ状態、ストレージ統計 |

---

## GPT/AI連携

### ローカルLLM推論（v6）

**Ollama + Qwen2.5:3b** によるローカル推論（APIコストゼロ）

```
ノート保存 → LLM推論 → 結果保存
              ↓
        confidence 判定
        ├─ ≥ 0.85: 自動反映
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

---

## データ構造

### 主要テーブル

| テーブル | 説明 |
|----------|------|
| `notes` | ノート本体（タイトル、本文、タグ、カテゴリ） |
| `note_history` | 変更履歴スナップショット |
| `note_embeddings` | 1536次元ベクトル |
| `note_inferences` | 推論結果（タイプ、Intent、確信度） |
| `llm_inference_results` | LLM推論結果と承認状態 |
| `clusteringSnapshots` | クラスタリングスナップショット |
| `clusterIdentities` | クラスタの論理的アイデンティティ |
| `review_schedules` | Spaced Reviewスケジュール |
| `recall_questions` | Active Recall用の質問 |
| `bookmark_nodes` | ブックマーク階層構造 |
| `secret_box_items` | メディアファイル |

**合計23テーブル**

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

### 主要ドメイン

| ドメイン | コマンド例 |
|----------|-----------|
| `note` | create, get, update, delete, list, history |
| `search` | query, categories, byTitle |
| `cluster` | list, get, evolution, events |
| `review` | queue, start, submit, schedule |
| `llmInference` | execute, approve, override, weeklySummary |
| `gpt` | search, context, coachDecision |
| `ptm` | today, insight, influence |
| `drift` | timeline, warning, forecast |
| `bookmark` | list, create, move, reorder |

**100+ APIアクション**が利用可能

---

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript 100% |
| サーバー | Hono |
| UI | React + Vite |
| データベース | SQLite (Drizzle ORM) |
| 検索 | FTS5 + MiniLM Embedding |
| LLM推論 | Ollama + Qwen2.5:3b |
| 日本語処理 | TinySegmenter |

---

## バージョン履歴

| バージョン | 主要機能 |
|------------|----------|
| v4 | 判断ファースト（ノートタイプ分類、Intent） |
| v5 | ブックマーク、シークレットBOX、Spaced Review |
| v6 | ローカルLLM推論（Ollama統合） |
| v7 | Temporal Clustering（思考系譜追跡） |

---

## 特徴

1. **完全ローカル動作**: すべてのデータはSQLiteに保存、オフラインで動作
2. **APIコストゼロ**: ローカルLLM（Ollama）による推論
3. **統一API設計**: 100+のアクションを単一エンドポイントで提供
4. **多面的分析**: PTM/Drift/Influence/Isolationなど複数の分析レンズ
5. **学習支援**: Spaced Review + Active Recallで知識定着を強化
6. **思考の可視化**: ネットワークグラフ、タイムライン、クラスタ進化

---

*最終更新: 2026-01-03*
