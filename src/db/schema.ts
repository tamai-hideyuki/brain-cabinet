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

// v8 視点タイプ定義（思考成長レポート用）
export const PERSPECTIVES = [
  "engineer",     // 技術者: 技術的正しさ、実装詳細
  "po",           // PO: ビジネス価値、ユーザー課題
  "user",         // ユーザー: 使いやすさ、UX
  "cto",          // CTO: 技術戦略、スケーラビリティ
  "team",         // チーム: メンバー、協業
  "stakeholder",  // ステークホルダー: 経営、事業インパクト
] as const;
export type Perspective = (typeof PERSPECTIVES)[number];

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  path: text("path").notNull(),
  content: text("content").notNull(),
  tags: text("tags"),                    // JSON配列として保存 e.g. '["TypeScript","API"]'
  category: text("category"),            // カテゴリ e.g. "技術"
  headings: text("headings"),            // 見出し一覧（JSON） e.g. '["概要","実装"]'
  clusterId: integer("cluster_id"),      // 所属クラスタID（自動更新）
  perspective: text("perspective"),      // v8: 視点タイプ e.g. "engineer", "po", "user"
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
  deletedAt: integer("deleted_at"),      // ソフトデリート用: 削除日時（NULLなら未削除）
});

export const noteHistory = sqliteTable("note_history", {
  id: text("id").primaryKey(),                 // UUID
  noteId: text("note_id").notNull(),           // 紐づく元のメモ
  content: text("content").notNull(),          // 変更時点の全文スナップショット
  diff: text("diff"),                           // 差分（任意）
  semanticDiff: text("semantic_diff"),          // 意味的差分スコア（0.0〜1.0）JSON文字列
  prevClusterId: integer("prev_cluster_id"),    // v3: 変更前のクラスタID
  newClusterId: integer("new_cluster_id"),      // v3: 変更後のクラスタID
  changeType: text("change_type"),              // v5.6: 変化タイプ (SemanticChangeType)
  changeDetail: text("change_detail"),          // v5.6: 変化詳細情報 (JSON)
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

// ============================================================
// v5.6 セマンティック変化タイプ（Semantic Change Classification）
// ============================================================

// 変化タイプ定義
export const SEMANTIC_CHANGE_TYPES = [
  "expansion",    // 拡張: 既存の概念を広げた（情報追加、範囲拡大）
  "contraction",  // 縮小: 絞り込み・要約（情報削減、焦点化）
  "pivot",        // 転換: 別の方向へ転換（主題変更、方向転換）
  "deepening",    // 深化: 同概念の深掘り（詳細化、具体化）
  "refinement",   // 洗練: 表現の改善（推敲、誤字修正、意味は同じ）
] as const;
export type SemanticChangeType = (typeof SEMANTIC_CHANGE_TYPES)[number];

// セマンティック変化の詳細情報
export type SemanticChangeDetail = {
  type: SemanticChangeType;           // 変化タイプ
  confidence: number;                  // 分類の確信度 (0.0〜1.0)
  magnitude: number;                   // 変化の大きさ (0.0〜1.0) = semantic_diff
  direction: number[];                 // 変化方向ベクトル（正規化済み、次元はembeddingと同じ）
  metrics: {
    contentLengthRatio: number;        // 長さ比率: new/old (>1: 拡張, <1: 縮小)
    topicShift: number;                // トピック移動度 (0.0〜1.0)
    vocabularyOverlap: number;         // 語彙重複率 (0.0〜1.0)
    structuralSimilarity: number;      // 構造類似度 (0.0〜1.0) - 見出し・段落構造
  };
};

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

// ============================================================
// v4.3 昇格通知機能（Promotion Notifications）
// ============================================================

// トリガータイプ定義
export const PROMOTION_TRIGGER_TYPES = [
  "confidence_rise",   // confidence が閾値に近づいた
  "frequency",         // 同じノートが複数回更新された
  "pattern_match",     // 特定パターンにマッチ（将来用）
] as const;
export type PromotionTriggerType = (typeof PROMOTION_TRIGGER_TYPES)[number];

// 通知ステータス定義
export const PROMOTION_STATUSES = [
  "pending",    // 未対応
  "dismissed",  // 却下（今回は昇格しない）
  "promoted",   // 昇格実行済み
] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

// 通知ソース定義
export const PROMOTION_SOURCES = [
  "realtime",  // ノート保存時に検出
  "batch",     // 日次バッチで検出
] as const;
export type PromotionSource = (typeof PROMOTION_SOURCES)[number];

// 昇格通知テーブル
export const promotionNotifications = sqliteTable("promotion_notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),                       // 対象ノートID
  triggerType: text("trigger_type").notNull(),             // PromotionTriggerType
  source: text("source").notNull(),                        // PromotionSource
  suggestedType: text("suggested_type").notNull(),         // 推奨タイプ: "decision" | "learning"
  reason: text("reason").notNull(),                        // 昇格を推奨する理由（人間向け）
  confidence: real("confidence").notNull(),                // 検出時の confidence
  reasonDetail: text("reason_detail"),                     // 詳細情報（JSON）: frequencyCount, confidenceDelta, matchedPatterns
  status: text("status").notNull().default("pending"),     // PromotionStatus
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  resolvedAt: integer("resolved_at"),                      // ユーザーが対応した日時
});

// ============================================================
// v4.4 反証ログ機能（Counterevidence Log）
// ============================================================

// 反証タイプ定義
export const COUNTEREVIDENCE_TYPES = [
  "regret",              // 後悔・やり直したい点
  "missed_alternative",  // 見落とした選択肢
  "unexpected_outcome",  // 予想外の結果
  "contradiction",       // 矛盾する判断を後でした
] as const;
export type CounterevidencelType = (typeof COUNTEREVIDENCE_TYPES)[number];

// 深刻度定義
export const COUNTEREVIDENCE_SEVERITIES = [
  "minor",    // 軽微：影響は限定的
  "major",    // 重大：判断の見直しが必要
  "critical", // 致命的：根本的な方針変更が必要
] as const;
export type CounterevidencelSeverity = (typeof COUNTEREVIDENCE_SEVERITIES)[number];

// 反証ログテーブル
export const decisionCounterevidences = sqliteTable("decision_counterevidences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  decisionNoteId: text("decision_note_id").notNull(),      // 元の判断ノートID
  type: text("type").notNull(),                            // CounterevidencelType
  content: text("content").notNull(),                      // 反証内容
  sourceNoteId: text("source_note_id"),                    // 反証の元になったノートID（あれば）
  severityScore: real("severity_score").notNull().default(0.5),  // 0.0-1.0（計算用）
  severityLabel: text("severity_label").notNull().default("minor"), // CounterevidencelSeverity
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v4.5 Spaced Review + Active Recall
// ============================================================

// SM-2 品質評価定義 (0-5)
// 0: 完全忘却, 1: 不正解(思い出した), 2: 不正解(簡単に思い出せた)
// 3: 正解(困難), 4: 正解(少し躊躇), 5: 完璧
export const RECALL_QUALITIES = [0, 1, 2, 3, 4, 5] as const;
export type RecallQuality = (typeof RECALL_QUALITIES)[number];

// スケジュールソース定義
export const SCHEDULE_SOURCES = ["auto", "manual"] as const;
export type ScheduleSource = (typeof SCHEDULE_SOURCES)[number];

// レビュースケジュールテーブル（SM-2状態管理）
export const reviewSchedules = sqliteTable("review_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),                              // レビュー対象ノートID
  easinessFactor: real("easiness_factor").notNull().default(2.5), // EF (1.3〜, default 2.5)
  interval: integer("interval").notNull().default(1),             // 次回までの間隔（日）
  repetition: integer("repetition").notNull().default(0),         // 復習回数
  nextReviewAt: integer("next_review_at").notNull(),              // 次回レビュー日時（Unix秒）
  lastReviewedAt: integer("last_reviewed_at"),                    // 最終レビュー日時
  scheduledBy: text("scheduled_by").notNull().default("auto"),    // ScheduleSource
  isActive: integer("is_active").notNull().default(1),            // 1: アクティブ, 0: 停止
  fixedRevisionId: text("fixed_revision_id"),                     // v4.6: 固定版ID（note_history.id）- NULLなら常に最新版でレビュー
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// 質問タイプ定義
export const RECALL_QUESTION_TYPES = [
  "recall",       // 想起: 「このノートの主なポイントは？」
  "concept",      // 概念理解: 「〜とは何ですか？」
  "reasoning",    // 推論: 「なぜ〜なのですか？」(decision用)
  "application",  // 応用: 「〜の場合、どうしますか？」
  "comparison",   // 比較: 「AとBの違いは？」
] as const;
export type RecallQuestionType = (typeof RECALL_QUESTION_TYPES)[number];

// 質問生成ソース定義
export const QUESTION_SOURCES = ["template", "llm"] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

// Active Recall 質問テーブル
export const recallQuestions = sqliteTable("recall_questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),                              // 対象ノートID
  questionType: text("question_type").notNull(),                  // RecallQuestionType
  question: text("question").notNull(),                           // 質問文
  expectedKeywords: text("expected_keywords"),                    // 期待されるキーワード（JSON配列）
  source: text("source").notNull().default("template"),           // QuestionSource
  isActive: integer("is_active").notNull().default(1),            // 有効/無効
  contentHash: text("content_hash"),                              // コンテンツハッシュ（更新検出用）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// レビューセッションログ
export const reviewSessions = sqliteTable("review_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),                              // レビュー対象ノートID
  scheduleId: integer("schedule_id").notNull(),                   // レビュースケジュールID
  quality: integer("quality").notNull(),                          // RecallQuality (0-5)
  responseTimeMs: integer("response_time_ms"),                    // 回答時間（ミリ秒）
  questionsAttempted: integer("questions_attempted"),             // 試行した質問数
  questionsCorrect: integer("questions_correct"),                 // 正解数
  easinessFactorBefore: real("easiness_factor_before"),           // レビュー前のEF
  easinessFactorAfter: real("easiness_factor_after"),             // レビュー後のEF
  intervalBefore: integer("interval_before"),                     // レビュー前の間隔
  intervalAfter: integer("interval_after"),                       // レビュー後の間隔
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v5.2 ブックマーク機能（階層構造による参照管理）
// ============================================================

// ブックマークノードタイプ定義
export const BOOKMARK_NODE_TYPES = [
  "folder",    // フォルダ（他のノードを含む）
  "note",      // ノートへの参照
  "link",      // 外部リンク
] as const;
export type BookmarkNodeType = (typeof BOOKMARK_NODE_TYPES)[number];

// ブックマークノードテーブル
export const bookmarkNodes = sqliteTable("bookmark_nodes", {
  id: text("id").primaryKey(),                                    // UUID
  parentId: text("parent_id"),                                    // 親ノードID（NULLならルート）
  type: text("type").notNull(),                                   // BookmarkNodeType
  name: text("name").notNull(),                                   // 表示名
  noteId: text("note_id"),                                        // type="note" の場合のノートID
  url: text("url"),                                               // type="link" の場合の外部URL
  position: integer("position").notNull().default(0),             // 同階層内の表示順
  isExpanded: integer("is_expanded").notNull().default(1),        // フォルダの展開状態（1: 展開, 0: 折りたたみ）
  libraryPosition: text("library_position"),                      // ライブラリ3D空間での位置 [x, y, z] JSON
  libraryColor: text("library_color"),                            // ライブラリ3D空間での色 (#RRGGBB形式)
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v5.3 シークレットBOX機能（メディアストレージ）
// ============================================================

// シークレットBOXアイテムタイプ定義
export const SECRET_BOX_ITEM_TYPES = ["image", "video", "document"] as const;
export type SecretBoxItemType = (typeof SECRET_BOX_ITEM_TYPES)[number];

// シークレットBOXアイテムテーブル
export const secretBoxItems = sqliteTable("secret_box_items", {
  id: text("id").primaryKey(),                                    // UUID
  name: text("name").notNull(),                                   // 表示名
  originalName: text("original_name").notNull(),                  // 元ファイル名
  type: text("type").notNull(),                                   // "image" | "video"
  mimeType: text("mime_type").notNull(),                          // MIME type
  size: integer("size").notNull(),                                // ファイルサイズ（バイト）
  data: blob("data").notNull(),                                   // バイナリデータ本体
  thumbnail: blob("thumbnail"),                                   // サムネイル（動画用）
  folderId: text("folder_id"),                                    // 所属フォルダID（NULLならルート）
  position: integer("position").notNull().default(0),             // 表示順
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v5.4 ノート画像埋め込み機能
// ============================================================

// ノート画像テーブル
export const noteImages = sqliteTable("note_images", {
  id: text("id").primaryKey(),                                      // UUID
  noteId: text("note_id").notNull(),                                // 紐づくノートID
  name: text("name").notNull(),                                     // 表示名
  mimeType: text("mime_type").notNull(),                            // MIME type
  size: integer("size").notNull(),                                  // ファイルサイズ（バイト）
  data: blob("data").notNull(),                                     // バイナリデータ本体
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// シークレットBOXフォルダテーブル
export const secretBoxFolders = sqliteTable("secret_box_folders", {
  id: text("id").primaryKey(),                                    // UUID
  name: text("name").notNull(),                                   // フォルダ名
  parentId: text("parent_id"),                                    // 親フォルダID（NULLならルート）
  position: integer("position").notNull().default(0),             // 表示順
  isExpanded: integer("is_expanded").notNull().default(1),        // 展開状態（1: 展開, 0: 折りたたみ）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v5.12 分析キャッシュ機能
// ============================================================

// キャッシュキータイプ定義
export const CACHE_KEY_TYPES = [
  "analytics_timescale",       // マルチタイムスケール分析
  "analytics_timescale_cluster", // クラスター別タイムスケール分析
  "influence_causal_summary",  // 因果分析サマリー
  "drift_flows",               // ドリフトフロー分析
  "clusters_quality",          // クラスター品質メトリクス
  "gpt_context",               // GPT向けコンテキスト
] as const;
export type CacheKeyType = (typeof CACHE_KEY_TYPES)[number];

// 分析キャッシュテーブル
export const analysisCache = sqliteTable("analysis_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cacheKey: text("cache_key").notNull(),                          // キャッシュキー（タイプ + パラメータ）
  keyType: text("key_type").notNull(),                            // CacheKeyType
  data: text("data").notNull(),                                   // JSON文字列
  ttlSeconds: integer("ttl_seconds").notNull(),                   // TTL（秒）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  expiresAt: integer("expires_at").notNull(),                     // 有効期限（Unix秒）
});

// ============================================================
// v6 LLM推論機能（Ollama + Qwen2.5:3b）
// ============================================================

// LLM推論ステータス定義
export const LLM_INFERENCE_STATUSES = [
  "auto_applied",           // 自動反映済み（confidence >= 0.85）
  "auto_applied_notified",  // 自動反映（週次通知、0.7-0.85）
  "pending",                // 保留中（confidence < 0.7）
  "approved",               // ユーザー承認済み
  "rejected",               // ユーザー却下
  "overridden",             // ユーザー上書き
] as const;
export type LlmInferenceStatus = (typeof LLM_INFERENCE_STATUSES)[number];

// LLM推論結果テーブル（AIイベント履歴はnote_historyと分離）
export const llmInferenceResults = sqliteTable("llm_inference_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteId: text("note_id").notNull(),                              // 対象ノートID

  // 推論結果
  type: text("type").notNull(),                                   // NoteType
  intent: text("intent").notNull(),                               // Intent
  confidence: real("confidence").notNull(),                       // 確信度 0.0〜1.0
  confidenceDetail: text("confidence_detail"),                    // JSON: { structural, semantic, reasoning }
  decayProfile: text("decay_profile"),                            // DecayProfile
  reasoning: text("reasoning"),                                   // LLMの推論理由（自然言語）

  // メタデータ
  model: text("model").notNull(),                                 // "qwen2.5:3b" など
  promptTokens: integer("prompt_tokens"),                         // 入力トークン数
  completionTokens: integer("completion_tokens"),                 // 出力トークン数

  // 堅牢性メタ情報
  contextTruncated: integer("context_truncated").notNull().default(0),  // 1=要約後推論
  fallbackUsed: integer("fallback_used").notNull().default(0),          // 1=ルールベースにフォールバック
  inferenceVersion: text("inference_version"),                    // "2025.01" 形式
  seed: integer("seed"),                                          // 再現性用シード値

  // ステータス管理
  status: text("status").notNull().default("pending"),            // LlmInferenceStatus

  // ユーザー介入
  userOverrideType: text("user_override_type"),                   // ユーザーが指定したタイプ
  userOverrideReason: text("user_override_reason"),               // ユーザーの理由
  resolvedAt: integer("resolved_at"),                             // 承認/却下/上書き日時

  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// v7 Temporal Clustering（時系列クラスタ追跡）
// ============================================================

// スナップショットトリガー定義
export const SNAPSHOT_TRIGGERS = [
  "significant_change",  // 有意な変化を検出
  "scheduled",           // 週次保険
  "manual",              // 手動実行
  "initial",             // 初回スナップショット
] as const;
export type SnapshotTrigger = (typeof SNAPSHOT_TRIGGERS)[number];

// クラスタリングスナップショット（世代管理）
export const clusteringSnapshots = sqliteTable("clustering_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prevSnapshotId: integer("prev_snapshot_id"),                    // 比較元スナップショット
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  trigger: text("trigger").notNull(),                             // SnapshotTrigger
  k: integer("k").notNull(),                                      // クラスタ数
  totalNotes: integer("total_notes").notNull(),
  avgCohesion: real("avg_cohesion"),                              // 全体の平均凝集度
  isCurrent: integer("is_current").notNull().default(0),          // 最新かどうか (0/1)

  // 変化検出用メトリクス
  changeScore: real("change_score"),                              // 前回からの変化度（0〜1）
  notesAdded: integer("notes_added").notNull().default(0),
  notesRemoved: integer("notes_removed").notNull().default(0),
});

// スナップショット内クラスタ
export const snapshotClusters = sqliteTable("snapshot_clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  snapshotId: integer("snapshot_id").notNull(),
  localId: integer("local_id").notNull(),                         // 0〜k-1（スナップショット内ID）
  centroid: blob("centroid").notNull(),                           // Float32Array
  centroidNorm: real("centroid_norm"),                            // cosine高速化用
  size: integer("size").notNull(),
  sampleNoteId: text("sample_note_id"),
  cohesion: real("cohesion"),
  identityId: integer("identity_id"),                             // v7.1: 論理クラスタID（cluster_identities.id）
});

// クラスタ継承関係（predecessor）
export const CONFIDENCE_LABELS = ["high", "medium", "low", "none"] as const;
export type ConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

export const clusterLineage = sqliteTable("cluster_lineage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  snapshotId: integer("snapshot_id").notNull(),                   // 新スナップショット
  clusterId: integer("cluster_id").notNull(),                     // snapshot_clusters.id
  predecessorClusterId: integer("predecessor_cluster_id"),        // 前スナップショットのsnapshot_clusters.id (NULLなら新規)
  similarity: real("similarity").notNull(),                       // predecessorとの類似度
  confidenceScore: real("confidence_score").notNull(),            // 0〜1の数値
  confidenceLabel: text("confidence_label").notNull(),            // high/medium/low/none
});

// クラスタイベントタイプ定義
export const CLUSTER_EVENT_TYPES = [
  "split",      // 分裂: 1つのpredecessorに複数の新クラスタ
  "merge",      // 統合: 複数の旧クラスタが1つの新クラスタに収束
  "extinct",    // 消滅: predecessorとして参照されなかった旧クラスタ
  "emerge",     // 新規出現: predecessorなし
  "continue",   // 継続: 1対1の継承
] as const;
export type ClusterEventType = (typeof CLUSTER_EVENT_TYPES)[number];

// クラスタイベント（分裂/統合/消滅/新規）
export const clusterEvents = sqliteTable("cluster_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  snapshotId: integer("snapshot_id").notNull(),                   // このイベントが発生したスナップショット
  eventType: text("event_type").notNull(),                        // ClusterEventType
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),

  // イベント詳細（JSON）
  // split:  { source: cluster_id, targets: [cluster_id, ...] }
  // merge:  { sources: [cluster_id, ...], target: cluster_id }
  // extinct: { cluster_id: id, last_size: n }
  // emerge: { cluster_id: id, initial_size: n }
  // continue: { from: cluster_id, to: cluster_id, similarity: 0.85 }
  details: text("details").notNull(),
});

// スナップショット内ノート割り当て
export const snapshotNoteAssignments = sqliteTable("snapshot_note_assignments", {
  snapshotId: integer("snapshot_id").notNull(),
  noteId: text("note_id").notNull(),
  clusterId: integer("cluster_id").notNull(),                     // snapshot_clusters.id
});

// ============================================================
// v7.1 クラスタアイデンティティ（論理クラスタID）
// ============================================================

// クラスタアイデンティティ（思考系譜の永続的な識別子）
export const clusterIdentities = sqliteTable("cluster_identities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
  label: text("label"),                                           // 例: "OAuth理解", "設計判断"
  description: text("description"),                               // 詳細説明
  isActive: integer("is_active").notNull().default(1),            // 1: アクティブ, 0: 消滅済み
  lastSeenSnapshotId: integer("last_seen_snapshot_id"),           // 最後に観測されたスナップショット
});

// ============================================================
// Voice Evaluation（観測者ルール評価ログ）
// ============================================================

export const voiceEvaluationLogs = sqliteTable("voice_evaluation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clusterId: integer("cluster_id").notNull(),                     // 評価対象クラスタID
  clusterName: text("cluster_name").notNull(),                    // クラスタ名
  promptVersion: text("prompt_version").notNull(),                // プロンプトバージョン
  totalSentences: integer("total_sentences").notNull(),           // 総文数
  assertionCount: integer("assertion_count").notNull(),           // 断定表現数（voice以外）
  causalCount: integer("causal_count").notNull(),                 // 因果表現数（voice以外）
  assertionRate: integer("assertion_rate").notNull(),             // 断定率（0-100）
  causalRate: integer("causal_rate").notNull(),                   // 因果率（0-100）
  structureSeparated: integer("structure_separated").notNull(),   // 1: 分離済み, 0: 未分離
  detectedExpressions: text("detected_expressions").notNull(),    // 検出表現（JSON）
  rawOutput: text("raw_output").notNull(),                        // 生データ（JSON）
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s','now'))`),
});

// ============================================================
// ポモドーロタイマー機能（デバイス間同期）
// ============================================================

// ポモドーロセッション履歴（完了したセッションの記録）
export const pomodoroSessions = sqliteTable("pomodoro_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),                                     // 'YYYY-MM-DD'
  completedAt: integer("completed_at").notNull(),                   // 完了時刻（Unix秒）
  duration: integer("duration").notNull(),                          // セッション時間（秒）
  isBreak: integer("is_break").notNull(),                           // 0: 作業, 1: 休憩
  description: text("description"),                                  // 作業内容
});

// ポモドーロタイマー状態（現在の状態、シングルトン）
export const pomodoroTimerState = sqliteTable("pomodoro_timer_state", {
  id: integer("id").primaryKey().default(1),                        // シングルトン（常にid=1）
  isRunning: integer("is_running").notNull().default(0),            // 0: 停止, 1: 実行中
  isBreak: integer("is_break").notNull().default(0),                // 0: 作業, 1: 休憩
  startedAt: integer("started_at"),                                 // タイマー開始時刻（Unix ms）
  totalDuration: integer("total_duration").notNull().default(1500), // 合計時間（秒）デフォルト25分
  remainingAtStart: integer("remaining_at_start"),                  // 開始時の残り時間（秒）
  description: text("description"),                                  // 現在のセッションの作業内容
  updatedAt: integer("updated_at").notNull().default(sql`(strftime('%s','now'))`),
});
