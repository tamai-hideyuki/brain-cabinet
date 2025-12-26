# Brain Cabinet ドキュメント

> v5.3.0 統合 Command API による個人思考ログ管理システム

---

## ドキュメント一覧

### アーキテクチャ・設計

| ドキュメント | 説明 |
|-------------|------|
| [architecture.md](./architecture.md) | システム全体の設計書。レイヤー構成、依存関係、各コンポーネントの役割を詳細に解説 |
| [functional-ddd-migration.md](./functional-ddd-migration.md) | 関数型DDD移行計画書。v6.0.0に向けたアーキテクチャ刷新ロードマップ |
| [network-diagram.md](./network-diagram.md) | ネットワーク構成図。Mermaid形式でシステム全体構成、データフロー、コンポーネント依存関係を可視化 |
| [security-diagram.md](./security-diagram.md) | セキュリティ構成図。認証フロー、アクセス制御、機密情報管理、脅威モデルを解説 |
| [er-diagram.md](./er-diagram.md) | データベースER図。21テーブルの関係をMermaid形式で表現 |

### 機能詳細

| ドキュメント | 説明 |
|-------------|------|
| [secret-box.md](./secret-box.md) | シークレットBOXアーキテクチャ。画像・動画保存機能の設計と実装詳細 |
| [spaced-review.md](./spaced-review.md) | 間隔反復学習（Spaced Review）とSM-2アルゴリズムの実装詳細 |
| [reviewSchedule.md](./reviewSchedule.md) | レビュー評価と再学習スケジュールのクイックリファレンス |

### UI・その他

| ドキュメント | 説明 |
|-------------|------|
| [markdown-rendering.md](./markdown-rendering.md) | Markdownレンダリング実装マニュアル |
| [suggestion.md](./suggestion.md) | UI機能提案書（Decision-First UIの設計概要） |
| [template.md](./template.md) | ノート作成テンプレート集 |
| [api-tools.json](./api-tools.json) | GPT Actions インポート用OpenAPI定義 |

---

## 目次（このドキュメント）

1. [概要](#概要)
2. [クイックスタート](#クイックスタート)
3. [API リファレンス](#api-リファレンス)
4. [エラーコード](#エラーコード)
5. [GPT連携設定](#gpt連携設定)
6. [同期コマンド](#同期コマンド)
7. [テストガイド](#テストガイド)
8. [バージョン履歴](#バージョン履歴)

---

## 概要

Brain Cabinet は、個人の思考ログ（ノート）を構造化し、GPT/AIエージェントと連携して再利用するためのナレッジ基盤です。

### 主な機能

- **統合 Command API**: 単一エンドポイント `/api/v1` ですべての操作を実行
- **三層検索**: キーワード（FTS5）/ セマンティック（Embedding）/ ハイブリッド
- **思考パターン分析**: PTM（Personal Thinking Model）による Drift・Influence・Dynamics 追跡
- **クラスタリング**: K-Means によるトピック自動分類
- **履歴管理**: Semantic Diff による意味的変化の追跡

---

## クイックスタート

```bash
# 依存関係インストール
pnpm install

# データベース初期化
pnpm migrate

# FTS5 インデックス初期化
pnpm init-fts

# Embedding 生成
pnpm init-embeddings

# サーバー起動
pnpm dev
# → http://localhost:3000
```

### CLIコマンド一覧

| コマンド | 説明 |
|---------|------|
| `pnpm dev` | 開発サーバー起動 |
| `pnpm migrate` | DBマイグレーション |
| `pnpm init-fts` | FTS5インデックス初期化 |
| `pnpm init-embeddings` | Embedding一括生成 |
| `pnpm import-notes <dir>` | Markdown → DB インポート |
| `pnpm export-notes` | DB → Markdown エクスポート |
| `pnpm sync-notes` | Markdown ↔ DB 同期 |
| `pnpm integrity-check` | 整合性チェック |

---

## API リファレンス

### 統合エンドポイント

```
POST /api/v1
Content-Type: application/json

{
  "domain": "note" | "search" | "cluster" | "gpt" | ...,
  "action": "create" | "get" | "list" | ...,
  "payload": { ... }
}
```

### レスポンス形式

```json
// 成功
{ "ok": true, "data": { ... } }

// エラー
{ "ok": false, "error": { "code": "...", "message": "..." } }
```

---

### Note ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `note.create` | ノート作成 | `{ title, content }` |
| `note.get` | ノート取得 | `{ id }` |
| `note.update` | ノート更新 | `{ id, content, title? }` |
| `note.delete` | ノート削除 | `{ id }` |
| `note.list` | ノート一覧 | `{ limit?, offset? }` |
| `note.history` | 履歴取得 | `{ id }` |
| `note.revert` | 履歴から復元 | `{ noteId, historyId }` |
| `note.batchDelete` | 一括削除 | `{ ids[] }` |

---

### Search ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `search.query` | 検索（モード切替可能） | `{ query, mode?, category?, tags?, limit? }` |
| `search.categories` | カテゴリ一覧取得 | - |
| `search.byTitle` | タイトル検索 | `{ title, exact?, limit? }` |

#### search.query の mode パラメータ

| mode | 説明 |
|------|------|
| `keyword` | キーワード検索（TF-IDF + FTS5）※デフォルト |
| `semantic` | セマンティック検索（Embedding類似度） |
| `hybrid` | ハイブリッド検索（keyword 60% + semantic 40%） |

---

### Cluster ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `cluster.list` | クラスタ一覧 | - |
| `cluster.get` | クラスタ詳細 | `{ id }` |
| `cluster.build` | 再構築 | `{ k? }` |
| `cluster.identity` | アイデンティティ | `{ id }` |

---

### GPT ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `gpt.search` | GPT向け検索 | `{ query, mode?, category? }` |
| `gpt.context` | コンテキスト取得 | `{ noteId }` |
| `gpt.task` | タスク推奨 | - |
| `gpt.overview` | 統計情報 | - |

---

### PTM ドメイン（Personal Thinking Model）

| Action | 説明 |
|--------|------|
| `ptm.today` | 今日のスナップショット |
| `ptm.insight` | インサイト |
| `ptm.dynamics` | 動態メトリクス |
| `ptm.stability` | 安定性メトリクス |

---

### Insight ドメイン

| Action | 説明 |
|--------|------|
| `insight.lite` | GPT用簡潔版 |
| `insight.full` | 全データ |
| `insight.coach` | 今日の助言 |

---

## エラーコード

### HTTPステータスマッピング

| ステータス | エラーパターン |
|-----------|---------------|
| 400 | `VALIDATION_*`, `BATCH_LIMIT_EXCEEDED` |
| 404 | `*_NOT_FOUND` |
| 500 | `INTERNAL`, `*_FAILED` |

### 主要エラーコード

| コード | 説明 |
|--------|------|
| `VALIDATION_REQUIRED` | 必須フィールド未指定 |
| `VALIDATION_INVALID_UUID` | UUID形式不正 |
| `NOTE_NOT_FOUND` | ノートが存在しない |
| `CLUSTER_NOT_FOUND` | クラスタが存在しない |
| `BATCH_LIMIT_EXCEEDED` | バッチ上限超過（100件） |

---

## GPT連携設定

### System Prompt 例

```
あなたは Brain Cabinet アシスタントです。
ユーザーの思考ログを管理する Brain Cabinet API と連携します。

## 基本ルール
1. 質問に答える前に gpt.search で検索
2. 見つかったノートは引用形式で参照
3. ノートがない場合はその旨を伝える
4. API エラー時は一般知識で回答

## 主要API
- gpt.search: 検索（mode=hybrid 推奨）
- gpt.context: ノート詳細
- gpt.task: タスク推奨
- insight.lite: 思考状態サマリー
```

### レスポンスフォーマット

```markdown
[回答本文]

---
📚 参照ノート:
- [ノートタイトル](ID: xxx) - 関連度: 高
```

---

## 同期コマンド

### DB → Markdown

```bash
pnpm export-notes
```

### Markdown → DB

```bash
pnpm sync-notes
```

### 差分確認

```bash
pnpm integrity-check
```

### 推奨フロー

1. `pnpm integrity-check` で状態確認
2. `DIFF` → 内容確認
3. `DB_ONLY` → `export-notes` でMD作成
4. `MD_ONLY` → `sync-notes` でDB登録

---

## テストガイド

### テスト実行

```bash
# 全テスト
pnpm test

# 特定ファイル
pnpm test src/utils/slugify

# ウォッチモード
pnpm test --watch

# カバレッジ
pnpm test --coverage
```

### ディレクトリ構造（Co-location）

```
src/utils/
├── slugify/
│   ├── index.ts      # 実装
│   └── index.test.ts # テスト
├── normalize/
│   ├── index.ts
│   └── index.test.ts
```

### テスト命名規則

```typescript
// 日本語・振る舞い駆動
describe("slugify", () => {
  it("スペースをハイフンに変換する", () => { ... });
});
```

---

## バージョン履歴

| バージョン | 主な変更 |
|-----------|---------|
| v5.3.0 | シークレットBOX（画像・動画保存）追加 |
| v5.2.0 | ブックマーク機能追加 |
| v4.8.0 | Decision-First + Spaced Review |
| v4.6.0 | レビュー固定版機能 (fixRevision) |
| v4.5.0 | Active Recall 質問自動生成 |
| v3.0.0 | 統合 Command API 導入 |

## v3 移行ガイド（レガシー）

### v2 → v3 の変更点

| v2 | v3+ |
|----|-----|
| `GET /api/notes` | `POST /api/v1 { action: "note.list" }` |
| `GET /api/notes/:id` | `POST /api/v1 { action: "note.get", payload: { id } }` |
| `POST /api/notes` | `POST /api/v1 { action: "note.create", payload: { ... } }` |
| `GET /api/search?q=...` | `POST /api/v1 { action: "search.query", payload: { query, mode: "hybrid" } }` |

### 移行チェックリスト

- [ ] API呼び出しを `/api/v1` に変更
- [ ] レスポンス処理を `ok` フラグベースに変更
- [ ] エラーハンドリングを統一形式に対応

---

## 関連ファイル

| ファイル | 説明 |
|----------|------|
| [api-tools.json](./api-tools.json) | GPT Actions インポート用JSON |

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Web Framework | Hono |
| Database | SQLite (libsql) |
| ORM | Drizzle ORM |
| 全文検索 | SQLite FTS5 |
| Embedding | ローカル MiniLM |
| 日本語NLP | TinySegmenter |
| ロギング | Pino |

---

**Brain Cabinet** - Your External Brain for AI
