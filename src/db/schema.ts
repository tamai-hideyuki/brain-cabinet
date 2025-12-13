import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// カテゴリ定義
export const CATEGORIES = [
  "技術",
  "心理",
  "健康",
  "仕事",
  "人間関係",
  "学習",
  "アイデア",
  "走り書き",
  "その他",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  path: text("path").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),                    // JSON配列として保存 e.g. '["TypeScript","API"]'
  category: text("category"),            // カテゴリ e.g. "技術"
  headings: text("headings"),            // 見出し一覧（JSON） e.g. '["概要","実装"]'
  clusterId: integer("cluster_id"),      // 所属クラスタID（自動更新）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

export const noteHistory = sqliteTable("note_history", {
  id: text("id").primaryKey(),                 // UUID
  noteId: text("note_id").notNull(),           // 紐づく元のメモ
  content: text("content").notNull(),          // 変更時点の全文スナップショット
  diff: text("diff"),                           // 差分（任意）
  semanticDiff: text("semantic_diff"),          // 意味的差分スコア（0.0〜1.0）JSON文字列
  prevClusterId: integer("prev_cluster_id"),    // v3: 変更前のクラスタID
  newClusterId: integer("new_cluster_id"),      // v3: 変更後のクラスタID
  createdAt: integer("created_at").notNull(),   // 履歴保存日時
});

// Relation タイプ
export const RELATION_TYPES = [
  "similar",    // 類似ノート（0.85以上）
  "derived",    // 派生ノート（0.92以上）
  "reference",  // 参照（将来用）
  "summary_of", // 要約（将来用）
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export const noteRelations = sqliteTable("note_relations", {
  id: text("id").primaryKey(),                          // UUID
  sourceNoteId: text("source_note_id").notNull(),       // 関係元ノート
  targetNoteId: text("target_note_id").notNull(),       // 関係先ノート
  relationType: text("relation_type").notNull(),        // "similar" | "derived" | etc.
  score: text("score").notNull(),                        // 類似度スコア（JSON文字列）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// クラスタテーブル
export const clusters = sqliteTable("clusters", {
  id: integer("id").primaryKey(),                        // クラスタID（0〜k-1）
  centroid: text("centroid"),                            // クラスタ中心（BLOBをBase64で保存）
  size: integer("size").notNull().default(0),            // クラスタ内のノート数
  sampleNoteId: text("sample_note_id"),                  // 代表ノートID（中心に最も近いノート）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// Embeddingテーブル（v3拡張カラム含む）
export const noteEmbeddings = sqliteTable("note_embeddings", {
  noteId: text("note_id").primaryKey(),
  embedding: blob("embedding").notNull(),
  model: text("model").notNull().default("text-embedding-3-small"),
  dimensions: integer("dimensions").notNull().default(1536),
  vectorNorm: real("vector_norm"),                       // v3: ベクトルの長さ（ノルム）
  semanticDiff: real("semantic_diff"),                   // v3: 前バージョンとの意味差分
  clusterId: integer("cluster_id"),                      // v3: 現在のクラスタID
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v3 新規テーブル
// ============================================================

// クラスタ遷移履歴
export const clusterHistory = sqliteTable("cluster_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),
  clusterId: integer("cluster_id").notNull(),
  assignedAt: integer("assigned_at").notNull().default(sql`(strftime('%s','now'))`),
});

// クラスタ間の影響グラフ（Concept Influence Graph）
export const conceptGraphEdges = sqliteTable("concept_graph_edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceCluster: integer("source_cluster").notNull(),
  targetCluster: integer("target_cluster").notNull(),
  weight: real("weight").notNull(),                      // 0.0〜1.0
  mutual: real("mutual").notNull(),                      // 双方向性の強さ
  lastUpdated: integer("last_updated").notNull().default(sql`(strftime('%s','now'))`),
});

// 日次メトリクス時系列
export const metricsTimeSeries = sqliteTable("metrics_time_series", {
  date: text("date").primaryKey(),                       // '2025-12-07'
  noteCount: integer("note_count").notNull(),
  avgSemanticDiff: real("avg_semantic_diff"),
  dominantCluster: integer("dominant_cluster"),
  entropy: real("entropy"),                              // 思考分散度
  growthVector: blob("growth_vector"),
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ドリフトイベントタイプ
export const DRIFT_SEVERITY = ["low", "mid", "high"] as const;
export type DriftSeverity = (typeof DRIFT_SEVERITY)[number];

export const DRIFT_TYPES = [
  "cluster_bias",   // 特定クラスタへの偏り
  "drift_drop",     // 思考活動の低下
  "over_focus",     // 過集中
  "stagnation",     // 停滞
  "divergence",     // 発散（多方向に分散しすぎ）
] as const;
export type DriftType = (typeof DRIFT_TYPES)[number];

// ドリフト・偏り検出イベント
export const driftEvents = sqliteTable("drift_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  detectedAt: integer("detected_at").notNull().default(sql`(strftime('%s','now'))`),
  severity: text("severity").notNull(),                  // 'low' | 'mid' | 'high'
  type: text("type").notNull(),                          // DriftType
  message: text("message").notNull(),
  relatedCluster: integer("related_cluster"),
  resolvedAt: integer("resolved_at"),                    // 解消日時（NULLなら未解消）
});

// ノート間の影響グラフ（Concept Influence Graph - C モデル）
export const noteInfluenceEdges = sqliteTable("note_influence_edges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceNoteId: text("source_note_id").notNull(),    // 影響元のノート
  targetNoteId: text("target_note_id").notNull(),    // 影響先のノート（ドリフトしたノート）
  weight: real("weight").notNull(),                  // 影響の強さ (0.0〜1.0)
  cosineSim: real("cosine_sim").notNull(),           // コサイン類似度
  driftScore: real("drift_score").notNull(),         // ドリフトスコア
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// クラスタ動態（日次スナップショット）
export const clusterDynamics = sqliteTable("cluster_dynamics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),                              // ISO日付 'YYYY-MM-DD'
  clusterId: integer("cluster_id").notNull(),                // クラスタID
  centroid: blob("centroid").notNull(),                      // クラスタ重心（Float32Array）
  cohesion: real("cohesion").notNull(),                      // 凝集度（0.0〜1.0）
  noteCount: integer("note_count").notNull(),                // クラスタ内ノート数
  interactions: text("interactions"),                        // 他クラスタとの距離（JSON）
  stabilityScore: real("stability_score"),                   // 前日からの変化量
  createdAt: text("created_at").notNull(),
});

// Personal Thinking Model スナップショット
export const ptmSnapshots = sqliteTable("ptm_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  capturedAt: integer("captured_at").notNull().default(sql`(strftime('%s','now'))`),
  centerOfGravity: blob("center_of_gravity"),            // 思考の重心ベクトル
  clusterStrengths: blob("cluster_strengths"),           // クラスタ別スコア
  influenceMap: blob("influence_map"),                   // クラスタ間影響行列
  imbalanceScore: real("imbalance_score"),               // 偏り度 0.0〜1.0
  growthDirection: blob("growth_direction"),             // 成長ベクトル
  summary: text("summary"),                              // GPT生成レポート
});

// ジョブステータス
export const JOB_STATUSES = ["pending", "running", "completed", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_TYPES = ["NOTE_ANALYZE", "CLUSTER_REBUILD", "EMBEDDING_RECALC", "INDEX_REBUILD"] as const;
export type JobType = (typeof JOB_TYPES)[number];

// ワークフローステータス
export const WORKFLOW_TYPES = ["reconstruct"] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export const WORKFLOW_STATUSES = ["idle", "running", "completed", "failed"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const WORKFLOW_STEP_STATUSES = ["pending", "in_progress", "completed", "failed", "enqueued"] as const;
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number];

export const workflowStatus = sqliteTable("workflow_status", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflow: text("workflow").notNull(),              // "reconstruct"
  status: text("status").notNull(),                  // WorkflowStatus
  progress: text("progress"),                        // JSON: 各ステップの進捗
  clusterJobId: text("cluster_job_id"),              // CLUSTER_REBUILD ジョブID（参照用）
  startedAt: integer("started_at"),
  completedAt: integer("completed_at"),
  error: text("error"),
});

export const jobStatuses = sqliteTable("job_statuses", {
  id: text("id").primaryKey(),                             // UUID
  type: text("type").notNull(),                            // JobType
  status: text("status").notNull(),                        // JobStatus
  payload: text("payload"),                                // JSONペイロード
  result: text("result"),                                  // 成功時の結果（JSON）
  error: text("error"),                                    // 失敗時のエラーメッセージ
  progress: integer("progress"),                           // 進捗（0-100）
  progressMessage: text("progress_message"),               // 進捗メッセージ
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  startedAt: integer("started_at"),                        // 実行開始日時
  completedAt: integer("completed_at"),                    // 完了日時
});

// ============================================================
// v4 判断ファースト機能
// ============================================================

// ノートタイプ定義
export const NOTE_TYPES = [
  "decision",   // 判断・決定
  "learning",   // 学習・知識
  "scratch",    // 未整理メモ
  "emotion",    // 感情・心理
  "log",        // 事実記録
] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

// 意図・関心領域定義
export const INTENTS = [
  "architecture",    // 構造・責務・境界
  "design",          // 設計判断・UI/UX・仕様
  "implementation",  // 具体コード・実装
  "review",          // PR・レビュー・改善
  "process",         // 進め方・フロー・習慣
  "people",          // 人・チーム・関係性
  "unknown",         // 特定できない
] as const;
export type Intent = (typeof INTENTS)[number];

// 推論モデル定義
export const INFERENCE_MODELS = [
  "rule-v1",         // ルールベース推論
  "gpt-4.1",         // GPT推論
  "local-ml",        // ローカルML（将来用）
] as const;
export type InferenceModel = (typeof INFERENCE_MODELS)[number];

// v4.1 信頼度分解（Confidence Detail）
export type ConfidenceDetail = {
  structural: number;    // 構文ベース: 言い切り・比較・断定パターン (0.0〜1.0)
  experiential: number;  // 経験ベース: 過去の判断との類似度 (0.0〜1.0)
  temporal: number;      // 時間ベース: 直近か・繰り返し出ているか (0.0〜1.0)
};

// v4.2 時間減衰プロファイル（Decay Profile）
export const DECAY_PROFILES = [
  "stable",       // 安定判断: 半減期 ≈ 693日（アーキテクチャ原則など）
  "exploratory",  // 探索的判断: 半減期 ≈ 69日（技術選定の試行など）
  "situational",  // 状況的判断: 半減期 ≈ 14日（その場の判断）
] as const;
export type DecayProfile = (typeof DECAY_PROFILES)[number];

// 減衰率（λ）: score * e^(-λt) の λ
export const DECAY_RATES: Record<DecayProfile, number> = {
  stable: 0.001,      // 半減期 ≈ 693日
  exploratory: 0.01,  // 半減期 ≈ 69日
  situational: 0.05,  // 半減期 ≈ 14日
};

// ノート推論テーブル（判断ファーストの中核）
export const noteInferences = sqliteTable("note_inferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),                       // 紐づくノートID
  type: text("type").notNull(),                            // NoteType
  intent: text("intent").notNull(),                        // Intent
  confidence: real("confidence").notNull(),                // 確信度 0.0〜1.0（総合値・後方互換）
  confidenceDetail: text("confidence_detail"),             // v4.1: ConfidenceDetail（JSON）
  decayProfile: text("decay_profile"),                     // v4.2: DecayProfile
  model: text("model").notNull(),                          // 推論モデル
  reasoning: text("reasoning"),                            // 推論理由（短文 or JSON）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});
