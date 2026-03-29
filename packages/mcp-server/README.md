# Brain Cabinet MCP Server

Brain CabinetのCommand APIをMCPツールとして公開するサーバー。
Claude DesktopやClaude Codeからbrain-cabinetの全機能にアクセスできる。

## セットアップ

### 1. ビルド

```bash
cd packages/mcp-server
pnpm install
pnpm build
```

### 2. Claude Desktopに登録

`~/Library/Application Support/Claude/claude_desktop_config.json` に追加:

```json
{
  "mcpServers": {
    "brain-cabinet": {
      "command": "node",
      "args": ["/path/to/brain-cabinet/packages/mcp-server/dist/index.js"],
      "env": {
        "BRAIN_CABINET_API_URL": "https://api.brain-cabinet.com",
        "BRAIN_CABINET_API_KEY": "your-api-key"
      }
    }
  }
}
```

### 3. Claude Desktopを再起動

ツール一覧に brain-cabinet のツールが表示される。

## Claude Codeで使う場合

プロジェクトの `.mcp.json` に追加:

```json
{
  "mcpServers": {
    "brain-cabinet": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "BRAIN_CABINET_API_URL": "https://api.brain-cabinet.com",
        "BRAIN_CABINET_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 利用可能なツール

| ツール | 説明 |
|--------|------|
| `search` | ノートをキーワード・セマンティック・ハイブリッドで検索 |
| `get_note` | ノートを1件取得 |
| `list_notes` | ノート一覧 |
| `create_note` | ノート作成 |
| `update_note` | ノート更新 |
| `get_insight` | 今日のインサイト（軽量版） |
| `get_insight_full` | 詳細インサイト |
| `get_unified_context` | 統合コンテキスト |
| `ptm_today` | 今日のPTMスナップショット |
| `get_drift_summary` | ドリフトサマリー |
| `get_drift_warning` | ドリフト警告 |
| `list_clusters` | クラスター一覧 |
| `get_cluster_map` | クラスターマップ |
| `get_analytics_summary` | 統計サマリー |
| `search_decisions` | 意思決定ノート検索 |
| `get_review_queue` | レビュー待ち一覧 |
| `start_coaching` | コーチング開始 |
| `rag_context` | RAGコンテキスト取得 |
| `command` | 任意のコマンド実行（上記でカバーされていないアクション用） |

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `BRAIN_CABINET_API_URL` | `https://api.brain-cabinet.com` | APIのベースURL |
| `BRAIN_CABINET_API_KEY` | (空) | API認証キー |
