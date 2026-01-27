/**
 * Concept Influence Service（C モデル：Drift 連動）
 *
 * ノート更新時に影響エッジをリアルタイム生成
 *
 * 式: influence(A → B) = cosine(A, B) × drift_score(B)
 */

import * as influenceRepo from "../../repositories/influenceRepo";
import { computeDriftScore } from "../drift/computeDriftScore";
import { getAllEmbeddings, getEmbedding } from "../../repositories/embeddingRepo";
import {
  applyTimeDecayToEdges,
  filterByDecayedWeight,
  sortByDecayedWeight,
  calculateTimeDecayStats,
  DEFAULT_DECAY_RATE,
  type TimeDecayStats,
} from "../timeDecay";

const INFLUENCE_THRESHOLD = 0.15;
const DECAYED_WEIGHT_THRESHOLD = 0.05; // 時間減衰後の最小閾値

/**
 * コサイン類似度を計算（L2 正規化済みなので dot product）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export type InfluenceEdge = {
  sourceNoteId: string;
  targetNoteId: string;
  weight: number;
  cosineSim: number;
  driftScore: number;
  createdAt?: number;
};

export type InfluenceEdgeWithNoteInfo = InfluenceEdge & {
  sourceNote?: { id: string; title: string; clusterId: number | null } | null;
  targetNote?: { id: string; title: string; clusterId: number | null } | null;
};

/**
 * 時間減衰適用済みの影響エッジ (v5.7)
 */
export type InfluenceEdgeWithDecay = InfluenceEdge & {
  createdAt: number;
  decayedWeight: number;
  daysSinceCreation: number;
  decayFactor: number;
};

/**
 * ドリフトしたノートに対して影響エッジを生成
 *
 * @param targetNoteId - ドリフトしたノート（B）
 * @param semanticDiff - 意味的差分スコア
 * @param prevClusterId - 変更前のクラスタID
 * @param newClusterId - 変更後のクラスタID
 */
export async function generateInfluenceEdges(
  targetNoteId: string,
  semanticDiff: number,
  prevClusterId: number | null,
  newClusterId: number | null
): Promise<number> {
  // 1. ターゲットノートの embedding を取得
  const targetEmbedding = await getEmbedding(targetNoteId);
  if (!targetEmbedding) {
    return 0;
  }

  // 2. Drift Score を計算
  const { driftScore } = computeDriftScore({
    semanticDiff,
    oldClusterId: prevClusterId,
    newClusterId,
  });

  // しきい値未満のドリフトはスキップ
  if (driftScore < 0.1) {
    return 0;
  }

  // 3. 全ノートの embedding を取得
  const allEmbeddings = await getAllEmbeddings();

  // 4. 各ソースノートとの影響度を計算
  const now = Math.floor(Date.now() / 1000);
  let edgesCreated = 0;

  for (const { noteId: sourceNoteId, embedding: sourceEmbedding } of allEmbeddings) {
    // 自己参照はスキップ
    if (sourceNoteId === targetNoteId) continue;

    // コサイン類似度を計算
    const cosineSim = cosineSimilarity(sourceEmbedding, targetEmbedding);

    // influence(A → B) = cosine(A, B) × drift_score(B)
    const weight = round4(cosineSim * driftScore);

    // しきい値以下はスキップ
    if (weight < INFLUENCE_THRESHOLD) continue;

    // エッジを挿入/更新
    await influenceRepo.upsertInfluenceEdge({
      sourceNoteId,
      targetNoteId,
      weight,
      cosineSim: round4(cosineSim),
      driftScore: round4(driftScore),
      createdAt: now,
    });

    edgesCreated++;
  }

  return edgesCreated;
}

/**
 * ノートが削除されたとき、関連するエッジを削除
 */
export async function removeInfluenceEdges(noteId: string): Promise<void> {
  await influenceRepo.deleteInfluenceEdgesByNoteId(noteId);
}

/**
 * 特定ノートに影響を与えているノート一覧を取得
 */
export async function getInfluencersOf(
  noteId: string,
  limit: number = 10
): Promise<InfluenceEdgeWithNoteInfo[]> {
  const rows = await influenceRepo.findInfluencersOf(noteId, limit);

  return rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
    createdAt: r.created_at,
    sourceNote: r.source_title
      ? { id: r.source_note_id, title: r.source_title, clusterId: r.source_cluster_id }
      : null,
  }));
}

/**
 * 特定ノートに影響を与えているノート一覧を取得（時間減衰適用）(v5.7)
 */
export async function getInfluencersOfWithDecay(
  noteId: string,
  options: {
    limit?: number;
    lambda?: number;
    minDecayedWeight?: number;
  } = {}
): Promise<InfluenceEdgeWithDecay[]> {
  const { limit = 10, lambda = DEFAULT_DECAY_RATE, minDecayedWeight = DECAYED_WEIGHT_THRESHOLD } = options;

  // 減衰後に除外される可能性があるため、多めに取得
  const fetchLimit = limit * 3;

  const rows = await influenceRepo.findInfluencersOfRaw(noteId, fetchLimit);

  const edges = rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
    createdAt: r.created_at,
  }));

  // 時間減衰を適用
  const withDecay = applyTimeDecayToEdges(edges, lambda);

  // フィルタリング、ソート、リミット
  const filtered = filterByDecayedWeight(withDecay, minDecayedWeight);
  const sorted = sortByDecayedWeight(filtered);

  return sorted.slice(0, limit);
}

/**
 * 特定ノートが影響を与えているノート一覧を取得
 */
export async function getInfluencedBy(
  noteId: string,
  limit: number = 10
): Promise<InfluenceEdgeWithNoteInfo[]> {
  const rows = await influenceRepo.findInfluencedBy(noteId, limit);

  return rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
    createdAt: r.created_at,
    targetNote: r.target_title
      ? { id: r.target_note_id, title: r.target_title, clusterId: r.target_cluster_id }
      : null,
  }));
}

/**
 * 特定ノートが影響を与えているノート一覧を取得（時間減衰適用）(v5.7)
 */
export async function getInfluencedByWithDecay(
  noteId: string,
  options: {
    limit?: number;
    lambda?: number;
    minDecayedWeight?: number;
  } = {}
): Promise<InfluenceEdgeWithDecay[]> {
  const { limit = 10, lambda = DEFAULT_DECAY_RATE, minDecayedWeight = DECAYED_WEIGHT_THRESHOLD } = options;

  const fetchLimit = limit * 3;

  const rows = await influenceRepo.findInfluencedByRaw(noteId, fetchLimit);

  const edges = rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
    createdAt: r.created_at,
  }));

  const withDecay = applyTimeDecayToEdges(edges, lambda);
  const filtered = filterByDecayedWeight(withDecay, minDecayedWeight);
  const sorted = sortByDecayedWeight(filtered);

  return sorted.slice(0, limit);
}

/**
 * Influence Graph を再構築
 *
 * note_history から drift イベントを持つ履歴を取得し、
 * 影響エッジを再生成する
 */
export async function rebuildInfluenceGraph(): Promise<{
  cleared: number;
  edgesCreated: number;
  notesProcessed: number;
}> {
  // 既存のエッジを削除
  const cleared = await influenceRepo.countInfluenceEdges();

  await influenceRepo.deleteAllInfluenceEdges();

  // note_history から semantic_diff がある履歴を取得
  const historyRows = await influenceRepo.findHistoryWithSemanticDiff();

  let edgesCreated = 0;
  const processedNotes = new Set<string>();

  for (const row of historyRows) {
    if (!row.semantic_diff) continue;

    const semanticDiff = parseFloat(row.semantic_diff);
    if (isNaN(semanticDiff)) continue;

    const edges = await generateInfluenceEdges(
      row.note_id,
      semanticDiff,
      row.prev_cluster_id,
      row.new_cluster_id
    );

    edgesCreated += edges;
    processedNotes.add(row.note_id);
  }

  return {
    cleared,
    edgesCreated,
    notesProcessed: processedNotes.size,
  };
}

/**
 * グラフ全体のエッジを取得（可視化用）
 */
export async function getAllInfluenceEdges(limit: number = 200): Promise<InfluenceEdge[]> {
  const rows = await influenceRepo.findAllInfluenceEdges(limit);

  return rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
    createdAt: r.created_at,
  }));
}

/**
 * グラフ全体のエッジを取得（時間減衰適用）(v5.7)
 */
export async function getAllInfluenceEdgesWithDecay(
  options: {
    limit?: number;
    lambda?: number;
    minDecayedWeight?: number;
  } = {}
): Promise<InfluenceEdgeWithDecay[]> {
  const { limit = 200, lambda = DEFAULT_DECAY_RATE, minDecayedWeight = DECAYED_WEIGHT_THRESHOLD } = options;

  // 減衰後に除外される可能性があるため、多めに取得
  const fetchLimit = limit * 2;

  const rows = await influenceRepo.findAllInfluenceEdges(fetchLimit);

  const edges = rows.map((r) => ({
    sourceNoteId: r.source_note_id,
    targetNoteId: r.target_note_id,
    weight: r.weight,
    cosineSim: r.cosine_sim,
    driftScore: r.drift_score,
    createdAt: r.created_at,
  }));

  const withDecay = applyTimeDecayToEdges(edges, lambda);
  const filtered = filterByDecayedWeight(withDecay, minDecayedWeight);
  const sorted = sortByDecayedWeight(filtered);

  return sorted.slice(0, limit);
}

/**
 * 時間減衰統計を取得 (v5.7)
 */
export async function getInfluenceDecayStats(
  lambda: number = DEFAULT_DECAY_RATE
): Promise<TimeDecayStats> {
  const rows = await influenceRepo.findAllEdgesForDecayStats();

  const edges = rows.map((r) => ({
    weight: r.weight,
    createdAt: r.created_at,
  }));

  const withDecay = applyTimeDecayToEdges(edges, lambda);

  return calculateTimeDecayStats(withDecay, DECAYED_WEIGHT_THRESHOLD);
}

/**
 * グラフ全体の統計を取得
 */
export async function getInfluenceStats(): Promise<{
  totalEdges: number;
  avgWeight: number;
  maxWeight: number;
  topInfluencedNotes: Array<{
    noteId: string;
    edgeCount: number;
    totalInfluence: number;
  }>;
  topInfluencers: Array<{
    noteId: string;
    edgeCount: number;
    totalInfluence: number;
  }>;
}> {
  // 基本統計
  const basicStats = await influenceRepo.findInfluenceBasicStats();

  // 最も影響を受けたノート
  const topInfluenced = await influenceRepo.findTopInfluencedNotes(5);

  // 最も影響を与えているノート
  const topInfluencers = await influenceRepo.findTopInfluencerNotes(5);

  return {
    totalEdges: basicStats?.total_edges ?? 0,
    avgWeight: basicStats?.avg_weight ?? 0,
    maxWeight: basicStats?.max_weight ?? 0,
    topInfluencedNotes: topInfluenced.map((r) => ({
      noteId: r.target_note_id,
      edgeCount: r.edge_count,
      totalInfluence: r.total_influence,
    })),
    topInfluencers: topInfluencers.map((r) => ({
      noteId: r.source_note_id,
      edgeCount: r.edge_count,
      totalInfluence: r.total_influence,
    })),
  };
}
