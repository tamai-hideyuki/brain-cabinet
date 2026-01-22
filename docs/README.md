# Brain Cabinet ドキュメント

> v7.1.0 統合 Command API による個人思考ログ管理システム

---

## ドキュメント一覧

| ドキュメント | 説明 |
|-------------|------|
| [OVERVIEW.md](./OVERVIEW.md) | 機能概要・システム全体の説明 |
| [architecture.md](./architecture.md) | システム設計書（38テーブル、21ディスパッチャー、27サービス） |
| [er-diagram.md](./er-diagram.md) | データベースER図（Mermaid形式） |
| [network-diagram.md](./network-diagram.md) | ネットワーク構成図・データフロー |
| [security-diagram.md](./security-diagram.md) | セキュリティ構成図・認証フロー |
| [block-editor.md](./block-editor.md) | Notionライクブロックエディタ仕様 |

---

## 目次

1. [クイックスタート](#クイックスタート)
2. [API リファレンス](#api-リファレンス)
3. [エラーコード](#エラーコード)
4. [GPT連携設定](#gpt連携設定)
5. [同期コマンド](#同期コマンド)
6. [テストガイド](#テストガイド)

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
  "action": "domain.command",
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

### 主要ドメイン（21ディスパッチャー）

#### Note ドメイン

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

#### Search ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `search.query` | 検索 | `{ query, mode?, category?, tags?, limit? }` |
| `search.categories` | カテゴリ一覧 | - |
| `search.byTitle` | タイトル検索 | `{ title, exact?, limit? }` |

**mode パラメータ:**
- `keyword` - キーワード検索（TF-IDF + FTS5）※デフォルト
- `semantic` - セマンティック検索（Embedding類似度）
- `hybrid` - ハイブリッド検索（keyword 60% + semantic 40%）

#### Cluster ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `cluster.list` | クラスタ一覧 | - |
| `cluster.get` | クラスタ詳細 | `{ id }` |
| `cluster.rebuild` | 再構築 | `{ k? }` |

#### Review ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `review.queue` | レビュー待ち一覧 | - |
| `review.start` | レビュー開始 | `{ noteId }` |
| `review.submit` | レビュー結果送信 | `{ scheduleId, quality }` |
| `review.schedule` | スケジュール作成 | `{ noteId }` |

#### GPT ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `gpt.search` | GPT向け検索 | `{ query, mode?, category? }` |
| `gpt.context` | コンテキスト取得 | `{ noteId }` |
| `gpt.task` | タスク推奨 | - |
| `gpt.overview` | 統計情報 | - |
| `gpt.coachDecision` | 意思決定支援 | `{ question }` |

#### LLM Inference ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `llmInference.run` | LLM推論実行 | `{ noteId }` |
| `llmInference.get` | 推論結果取得 | `{ noteId }` |
| `llmInference.list` | 推論結果一覧 | `{ limit? }` |

#### Coaching ドメイン

| Action | 説明 | Payload |
|--------|------|---------|
| `coaching.start` | セッション開始 | `{ goal? }` |
| `coaching.message` | メッセージ送信 | `{ sessionId, content }` |
| `coaching.end` | セッション終了 | `{ sessionId }` |

#### その他のドメイン

| ドメイン | 主要Action |
|---------|-----------|
| `clusterDynamics` | get |
| `drift` | getTimeline, getState |
| `ptm` | latest, history |
| `influence` | graph, topInfluencers |
| `insight` | overview, growth |
| `analytics` | summary |
| `bookmark` | list, create, update, delete |
| `isolation` | detect, list |
| `promotion` | getCandidates, dismiss, promote |
| `decision` | search, context, compare |
| `rag` | query |
| `system` | health, embed, rebuildFts |
| `job` | getStatus, list |
| `workflow` | reconstruct |

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
- gpt.coachDecision: 意思決定支援
- insight.overview: 思考状態サマリー
```

### レスポンスフォーマット

```markdown
[回答本文]

---
参照ノート:
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

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| Web Framework | Hono |
| Database | SQLite (libsql) |
| ORM | Drizzle ORM |
| 全文検索 | SQLite FTS5 |
| Embedding | ローカル MiniLM |
| LLM | Ollama / OpenAI API |
| 日本語NLP | TinySegmenter |
| ロギング | Pino |

---

最終更新: 2026-01-19
