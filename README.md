# Brain Cabinet

思考ベースの知識管理システム — ノートの意味を理解し、成長を可視化する外部脳

## 特徴

- **セマンティック検索** — キーワードではなく意味で関連ノートを発見
- **Decision-First** — 判断ノートを自動分類し優先表示
- **3Dライブラリ** — ブックマークを本棚として3D空間に配置
- **PTM** — 思考モデルを日次スナップショット化
- **Drift分析** — 思考の成長角度を可視化・予測
- **Spaced Review** — SM-2アルゴリズムで間隔反復学習
- **GPT/Claude連携** — 外部脳として活用可能

## クイックスタート

```bash

git clone https://github.com/your-username/brain-cabinet.git
cd brain-cabinet
pnpm install

pnpm migrate

pnpm import-notes -- --dir /path/to/your/notes

pnpm init-fts          # 全文検索
pnpm init-embeddings   # Embedding（ローカル、API不要）

pnpm dev

cloudflared tunnel run brain-cabinet

```

## 主なUI

| パス | 説明 |
|------|------|
| `/ui/notes` | ノート一覧・検索 |
| `/ui/dashboard` | ダッシュボード |
| `/ui/library` | 3Dライブラリ |
| `/ui/network` | ネットワークグラフ |
| `/ui/timeline` | タイムライン |
| `/ui/evolution` | クラスタ進化UI |

## API

単一エンドポイントの Command API 形式:

```bash
POST /api/v1
{
  "action": "gpt.search",
  "payload": { "query": "TypeScript" }
}
```

主なアクション:

| ドメイン | 例 |
|---------|-----|
| `note.*` | `note.list`, `note.get`, `note.create`, `note.update` |
| `search.*` | `search.query`, `search.byTitle` |
| `cluster.*` | `cluster.list`, `cluster.get`, `cluster.rebuild` |
| `ptm.*` | `ptm.today`, `ptm.history`, `ptm.insight` |
| `drift.*` | `drift.timeline`, `drift.forecast`, `drift.warning` |
| `review.*` | `review.queue`, `review.start`, `review.submit` |
| `gpt.*` | `gpt.search`, `gpt.coachDecision`, `gpt.unifiedContext` |

## GPT連携

1. `openapi-command.json` を ChatGPT の Custom GPT にアップロード
2. サーバーを公開（Cloudflare Tunnel等）
3. GPTから自然言語で操作

```
「TypeScriptについての過去の判断を探して」
→ decision.search

「今日の思考状態を教えて」
→ insight.lite

「このノートをレビューしたい」
→ review.start
```

## アーキテクチャ: モジュラーモノリス

本プロジェクトは**モジュラーモノリス**を採用している。

### モジュラーモノリスとは

物理的には1つのプロセスだが、コード上はモジュール境界で論理的に分離されたアーキテクチャ。
マイクロサービス（物理分離）の運用コストを避けつつ、モノリスの依存関係カオスを防ぐ。

| | モノリス | モジュラーモノリス | マイクロサービス |
|---|---|---|---|
| 分離の種類 | なし | **論理分離** | 物理分離 |
| 境界の強制力 | なし | 規約（index.ts） | ネットワーク |
| 通信コスト | 関数呼び出し | 関数呼び出し | HTTP/gRPC |
| デプロイ | 1回 | 1回 | サービスごと |
| 将来の選択肢 | 全書き換え | 必要な部分だけ切り出し可能 | ここが終着点 |

### ディレクトリ構成

```
src/
├── app.ts / index.ts / dispatcher.ts   # エントリポイント
├── routes/api.ts                        # ルート登録ハブ
├── shared/                              # 横断的関心事
│   ├── db/          # DBクライアント、スキーマ
│   ├── middleware/   # 認証、エラーハンドリング
│   ├── utils/       # 共通ユーティリティ
│   ├── types/       # 共有型定義
│   └── config/      # OpenAPI設定
└── modules/                             # 23ドメインモジュール
    ├── note/        # メモCRUD、履歴、画像、リレーション
    ├── search/      # FTS、セマンティック検索、エンベディング
    ├── cluster/     # クラスタリング、メトリクス、進化
    ├── drift/       # ドリフト検出、予測
    ├── influence/   # 影響グラフ、因果推論、時間減衰
    ├── gpt/         # GPT/LLM統合、RAG
    ├── decision/    # 意思決定、反証
    ├── ptm/         # パーソナル思考モデル
    ├── inference/   # 型推論、LLM推論
    ├── review/      # SM-2スペース反復
    └── ...          # 他13モジュール
```

### モジュール境界のルール

各モジュールは `index.ts` を公開インターフェースとして持つ。**他モジュールからは必ずindex.ts経由でのみアクセスする。**

```ts
// OK: 公開インターフェース経由
import { findNoteById, createNote } from "../note";

// NG: 内部ファイルへの直接アクセス
import { findNoteById } from "../note/repository";
```

この規約により、モジュール内部の実装変更が他モジュールに影響しない。
将来特定のモジュールをマイクロサービスとして切り出す場合も、index.tsのインターフェースを維持すれば移行がスムーズに行える。

## 技術スタック

- **Frontend**: React 19, Vite, Three.js (3Dライブラリ)
- **Backend**: Hono (Node.js)
- **Database**: SQLite + Drizzle ORM (WALモード)
- **Search**: FTS5 + TF-IDF + セマンティック検索
- **Embedding**: ローカル MiniLM + HNSW（API不要）
- **LLM推論**: Ollama + Qwen2.5:3b（オプション）
- **認証**: Clerk

## ライセンス

MIT
