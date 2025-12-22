# Brain Cabinet ドキュメント目次

> v5.2.0 - 個人思考ログ管理システム "外部脳"

---

## ドキュメント一覧

### アーキテクチャ・設計

| ドキュメント | 説明 |
|-------------|------|
| [architecture.md](./architecture.md) | システム全体の設計書。レイヤー構成、依存関係、各コンポーネントの役割を詳細に解説。約26,000行のコードベースの全体像を把握するためのメインドキュメント。 |
| [network-diagram.md](./network-diagram.md) | ネットワーク構成図。Mermaid形式でシステム全体構成、データフロー、レイヤー構成、コンポーネント依存関係、デプロイ構成を可視化。 |
| [er-diagram.md](./er-diagram.md) | データベースER図。Drizzle ORM + SQLiteで構成された20以上のテーブル関係をMermaid形式で表現。各テーブルのカラム定義とリレーションを網羅。 |

### API・連携

| ドキュメント | 説明 |
|-------------|------|
| [README.md](./README.md) | メインドキュメント。クイックスタート、統合Command API リファレンス、エラーコード、GPT連携設定、CLIコマンド一覧、テストガイド、v3移行ガイドを収録。 |
| [api-tools.json](./api-tools.json) | GPT Actions インポート用OpenAPI定義。ChatGPTカスタムGPTと連携するためのツール定義JSON。検索、ノート取得、コンテキスト取得などのAPI仕様を記述。 |

### 機能詳細

| ドキュメント | 説明 |
|-------------|------|
| [spaced-review.md](./spaced-review.md) | 間隔反復学習（Spaced Review）と能動的想起（Active Recall）の実装詳細。SM-2アルゴリズムの解説、品質評価の基準、API アクションの仕様を記載。 |
| [reviewSchedule.md](./reviewSchedule.md) | レビュー評価と再学習スケジュールのクイックリファレンス。評価値(0-5)と次回レビューへの影響を一覧表示。 |

### UI・フロントエンド

| ドキュメント | 説明 |
|-------------|------|
| [markdown-rendering.md](./markdown-rendering.md) | Markdownレンダリング実装マニュアル。react-markdown + remark-gfm を使用したMarkdown表示コンポーネントの実装手順とスタイリング方法を解説。 |
| [suggestion.md](./suggestion.md) | UI機能提案書。Decision-Firstアーキテクチャに基づく5つのUI機能（判断ハイライト、成長ダッシュボード、影響グラフ、レビューキュー、昇格通知）の設計概要。 |

### テンプレート

| ドキュメント | 説明 |
|-------------|------|
| [template.md](./template.md) | ノート作成テンプレート集。瞬発キャプチャ用(scratch)、昇格後フォーマット(learning/decision)のテンプレートとメタデータ記法の例。 |

---

## クイックナビゲーション

### 初めての方へ
1. [README.md](./README.md) - クイックスタートとAPI概要
2. [architecture.md](./architecture.md) - システム設計の理解

### 開発者向け
1. [network-diagram.md](./network-diagram.md) - システム構成の把握
2. [er-diagram.md](./er-diagram.md) - データベース構造
3. [api-tools.json](./api-tools.json) - API仕様

### 機能を理解したい方へ
1. [spaced-review.md](./spaced-review.md) - 間隔反復学習機能
2. [suggestion.md](./suggestion.md) - UI機能概要

---

## 技術スタック概要

| カテゴリ | 技術 |
|---------|------|
| バックエンド | Hono (Node.js), TypeScript |
| データベース | SQLite (Drizzle ORM), WAL Mode |
| 全文検索 | SQLite FTS5 |
| Embedding | Xenova/all-MiniLM-L6-v2 (ローカル) |
| AI連携 | OpenAI API (GPT-4) |
| 認証 | Clerk (OAuth) |
| フロントエンド | React, TypeScript, TailwindCSS |
| 日本語NLP | TinySegmenter |

---

## 更新履歴

| バージョン | 主な変更 |
|-----------|---------|
| v5.2.0 | ブックマーク機能、ネットワーク構成図追加 |
| v4.8.0 | Decision-First + Spaced Review |
| v4.5.0 | Active Recall質問自動生成 |
| v3.0.0 | 統合Command API導入 |

---

**Brain Cabinet** - Your External Brain for AI
