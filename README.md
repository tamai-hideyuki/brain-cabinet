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

## 技術スタック

- **Frontend**: Next.js, React, Three.js (3Dライブラリ)
- **Backend**: Next.js API Routes
- **Database**: SQLite + better-sqlite3
- **Search**: FTS5 + TF-IDF
- **Embedding**: ローカル MiniLM（API不要）
- **LLM推論**: Ollama + Qwen2.5:3b（オプション）

## ライセンス

MIT
