#!/usr/bin/env node
/**
 * Brain Cabinet MCP Server
 *
 * Brain CabinetのCommand APIをMCPツールとして公開する。
 * Claude DesktopやClaude Codeからbrain-cabinetの全機能にアクセス可能。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { callBrainCabinet } from "./client.js";

const server = new McpServer({
  name: "brain-cabinet",
  version: "1.0.0",
});

// ============================================
// 検索・ノート参照
// ============================================

server.registerTool("search", {
  description: "ノートをキーワード・セマンティック・ハイブリッドで検索する",
  inputSchema: {
    query: z.string().describe("検索クエリ"),
    mode: z.enum(["keyword", "semantic", "hybrid"]).default("hybrid").describe("検索モード"),
    limit: z.number().default(10).describe("取得件数"),
  },
}, async ({ query, mode, limit }) =>
  callBrainCabinet("gpt.search", { query, mode, limit }),
);

server.registerTool("get_note", {
  description: "ノートIDを指定して1件取得する",
  inputSchema: {
    id: z.string().describe("ノートID"),
  },
}, async ({ id }) => callBrainCabinet("note.get", { id }));

server.registerTool("list_notes", {
  description: "ノート一覧を取得する",
  inputSchema: {
    limit: z.number().default(20).describe("取得件数"),
    offset: z.number().default(0).describe("オフセット"),
    sort: z.enum(["updated", "created", "title"]).default("updated").describe("ソート順"),
  },
}, async ({ limit, offset, sort }) =>
  callBrainCabinet("note.list", { limit, offset, sort }),
);

server.registerTool("get_note_history", {
  description: "ノートの変更履歴を取得する",
  inputSchema: {
    id: z.string().describe("ノートID"),
    limit: z.number().default(10).describe("取得件数"),
  },
}, async ({ id, limit }) =>
  callBrainCabinet("note.history", { id, limit }),
);

// ============================================
// ノート作成・編集
// ============================================

server.registerTool("create_note", {
  description: "新しいノートを作成する",
  inputSchema: {
    title: z.string().describe("タイトル"),
    content: z.string().describe("本文（Markdown）"),
    category: z.string().optional().describe("カテゴリ（技術, 心理, 健康, 仕事, 人間関係, 学習, アイデア, 走り書き, その他）"),
  },
}, async ({ title, content, category }) =>
  callBrainCabinet("note.create", { title, content, category }),
);

server.registerTool("update_note", {
  description: "既存のノートを更新する",
  inputSchema: {
    id: z.string().describe("ノートID"),
    content: z.string().describe("新しい本文"),
    title: z.string().optional().describe("新しいタイトル"),
  },
}, async ({ id, content, title }) =>
  callBrainCabinet("note.update", { id, content, title }),
);

// ============================================
// 思考分析・インサイト
// ============================================

server.registerTool("get_insight", {
  description: "今日の思考状態のインサイトを取得する（軽量版）",
}, async () => callBrainCabinet("insight.lite", {}));

server.registerTool("get_insight_full", {
  description: "思考状態の詳細インサイトを取得する（フル版）",
}, async () => callBrainCabinet("insight.full", {}));

server.registerTool("get_unified_context", {
  description: "GPT向け統合コンテキストを取得する（思考状態・トレンド・警告・推奨を一括取得）",
  inputSchema: {
    focus: z.enum(["overview", "trends", "warnings", "recommendations"]).default("overview").describe("フォーカス"),
  },
}, async ({ focus }) =>
  callBrainCabinet("gpt.unifiedContext", { focus }),
);

// ============================================
// PTM（パーソナル思考モデル）
// ============================================

server.registerTool("ptm_today", {
  description: "今日のPTMスナップショットを取得する",
}, async () => callBrainCabinet("ptm.today", {}));

server.registerTool("ptm_summary", {
  description: "PTMサマリーを取得する",
}, async () => callBrainCabinet("ptm.summary", {}));

// ============================================
// ドリフト分析
// ============================================

server.registerTool("get_drift_summary", {
  description: "思考ドリフトのサマリーを取得する",
  inputSchema: {
    rangeDays: z.number().default(30).describe("分析期間（日）"),
  },
}, async ({ rangeDays }) =>
  callBrainCabinet("drift.summary", { rangeDays }),
);

server.registerTool("get_drift_warning", {
  description: "思考ドリフトの警告を取得する",
  inputSchema: {
    rangeDays: z.number().default(30).describe("分析期間（日）"),
  },
}, async ({ rangeDays }) =>
  callBrainCabinet("drift.warning", { rangeDays }),
);

// ============================================
// クラスター
// ============================================

server.registerTool("list_clusters", {
  description: "クラスター一覧を取得する",
}, async () => callBrainCabinet("cluster.list", {}));

server.registerTool("get_cluster_map", {
  description: "クラスターのアイデンティティマップを取得する",
  inputSchema: {
    format: z.enum(["full", "gpt"]).default("gpt").describe("出力形式"),
  },
}, async ({ format }) =>
  callBrainCabinet("cluster.map", { format }),
);

// ============================================
// アナリティクス
// ============================================

server.registerTool("get_analytics_summary", {
  description: "全体の統計サマリーを取得する",
}, async () => callBrainCabinet("analytics.summary", {}));

// ============================================
// 意思決定
// ============================================

server.registerTool("search_decisions", {
  description: "意思決定ノートを検索する",
  inputSchema: {
    query: z.string().describe("検索クエリ"),
    limit: z.number().default(10).describe("取得件数"),
  },
}, async ({ query, limit }) =>
  callBrainCabinet("decision.search", { query, limit }),
);

// ============================================
// レビュー
// ============================================

server.registerTool("get_review_queue", {
  description: "レビュー待ちのノート一覧を取得する",
  inputSchema: {
    limit: z.number().default(10).describe("取得件数"),
  },
}, async ({ limit }) => callBrainCabinet("review.queue", { limit }));

// ============================================
// RAG
// ============================================

server.registerTool("rag_context", {
  description: "質問に関連するノートを検索しコンテキストを返す（RAG用）",
  inputSchema: {
    question: z.string().describe("質問文"),
    limit: z.number().default(5).describe("取得件数"),
  },
}, async ({ question, limit }) =>
  callBrainCabinet("rag.context", { question, limit }),
);

// ============================================
// 汎用コマンド
// ============================================

server.registerTool("command", {
  description: "任意のBrain Cabinetコマンドを実行する（上記ツールでカバーされていないアクション用）",
  inputSchema: {
    action: z.string().describe("アクション名（例: review.submit, bookmark.list）"),
    payload: z.string().default("{}").describe("ペイロード（JSON文字列）"),
  },
}, async ({ action, payload }) =>
  callBrainCabinet(action, JSON.parse(payload)),
);

// ============================================
// サーバー起動
// ============================================

const transport = new StdioServerTransport();
await server.connect(transport);
