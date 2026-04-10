/**
 * Isolation Detection Service
 *
 * 他のノートとの関連が薄い「孤立ノート」を検出するサービス
 *
 * 孤立度スコア = 1 - (接続度 / 平均接続度)
 * - 接続度 = in_weight + out_weight（入力・出力エッジの重みの合計）
 * - 孤立度が高い = 他ノートとの関連が薄い
 */

import * as isolationRepo from "./repository";
import { getAllEmbeddings, getEmbedding } from "../search";

/**
 * ノートの孤立度情報
 */
export type IsolationInfo = {
  noteId: string;
  title: string;
  category: string | null;
  clusterId: number | null;
  isolationScore: number; // 0〜1（1に近いほど孤立）
  inDegree: number; // 入力エッジ数
  outDegree: number; // 出力エッジ数
  inWeight: number; // 入力重み合計
  outWeight: number; // 出力重み合計
  connectivity: number; // 正規化された接続度
  avgSimilarity: number; // 他ノートとの平均類似度
  maxSimilarity: number; // 他ノートとの最大類似度
  createdAt: number;
  updatedAt: number;
};

/**
 * 孤立ノート検出の統計情報
 */
export type IsolationStats = {
  totalNotes: number;
  avgConnectivity: number;
  avgIsolationScore: number;
  isolatedCount: number; // threshold以上の孤立ノート数
  wellConnectedCount: number; // 良好に接続されたノート数
  noEdgesCount: number; // エッジが全くないノート数
};

/**
 * コサイン類似度を計算（L2正規化済みなのでdot product）
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * 全ノートの接続度を計算
 */
async function calculateConnectivity(): Promise<
  Map<
    string,
    {
      inDegree: number;
      outDegree: number;
      inWeight: number;
      outWeight: number;
    }
  >
> {
  // 入力エッジの集計
  const inEdges = await isolationRepo.findInEdgeSummary();

  // 出力エッジの集計
  const outEdges = await isolationRepo.findOutEdgeSummary();

  const connectivityMap = new Map<
    string,
    {
      inDegree: number;
      outDegree: number;
      inWeight: number;
      outWeight: number;
    }
  >();

  for (const row of inEdges) {
    const existing = connectivityMap.get(row.target_note_id) || {
      inDegree: 0,
      outDegree: 0,
      inWeight: 0,
      outWeight: 0,
    };
    existing.inDegree = row.in_degree;
    existing.inWeight = row.in_weight;
    connectivityMap.set(row.target_note_id, existing);
  }

  for (const row of outEdges) {
    const existing = connectivityMap.get(row.source_note_id) || {
      inDegree: 0,
      outDegree: 0,
      inWeight: 0,
      outWeight: 0,
    };
    existing.outDegree = row.out_degree;
    existing.outWeight = row.out_weight;
    connectivityMap.set(row.source_note_id, existing);
  }

  return connectivityMap;
}

/**
 * 単一ノートのembedding類似度を計算（embeddingを直接受け取る）
 */
function calculateSimilarityStats(
  noteId: string,
  targetEmbedding: number[],
  allEmbeddings: Array<{ noteId: string; embedding: number[] }>
): { avgSimilarity: number; maxSimilarity: number } {
  let totalSim = 0;
  let maxSim = 0;
  let count = 0;

  for (const { noteId: otherId, embedding } of allEmbeddings) {
    if (otherId === noteId) continue;
    const sim = cosineSimilarity(targetEmbedding, embedding);
    totalSim += sim;
    maxSim = Math.max(maxSim, sim);
    count++;
  }

  return {
    avgSimilarity: count > 0 ? totalSim / count : 0,
    maxSimilarity: maxSim,
  };
}

/**
 * 全ノートの類似度統計を一括計算（O(N²)だがループ1回で全ノート分を計算）
 */
function calculateAllSimilarityStats(
  allEmbeddings: Array<{ noteId: string; embedding: number[] }>
): Map<string, { avgSimilarity: number; maxSimilarity: number }> {
  const n = allEmbeddings.length;
  const totals = new Float64Array(n);
  const maxes = new Float64Array(n);
  const count = n - 1;

  // 対称性を利用: sim(i,j) = sim(j,i) なので計算量を半分に
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(allEmbeddings[i].embedding, allEmbeddings[j].embedding);
      totals[i] += sim;
      totals[j] += sim;
      if (sim > maxes[i]) maxes[i] = sim;
      if (sim > maxes[j]) maxes[j] = sim;
    }
  }

  const result = new Map<string, { avgSimilarity: number; maxSimilarity: number }>();
  for (let i = 0; i < n; i++) {
    result.set(allEmbeddings[i].noteId, {
      avgSimilarity: count > 0 ? totals[i] / count : 0,
      maxSimilarity: maxes[i],
    });
  }
  return result;
}

/**
 * 孤立ノートを検出
 *
 * @param threshold - 孤立度の閾値（デフォルト0.7）
 * @param limit - 返すノートの最大数
 * @param includeSimilarity - embedding類似度も計算するか（重いので任意）
 */
export async function detectIsolatedNotes(
  options: {
    threshold?: number;
    limit?: number;
    includeSimilarity?: boolean;
  } = {}
): Promise<IsolationInfo[]> {
  const { threshold = 0.7, limit = 50, includeSimilarity = true } = options;

  // 全ノートを取得
  const notes = await isolationRepo.findAllNotes();

  if (notes.length === 0) {
    return [];
  }

  // 接続度を計算
  const connectivityMap = await calculateConnectivity();

  // 平均接続度を計算
  let totalConnectivity = 0;
  for (const conn of connectivityMap.values()) {
    totalConnectivity += conn.inWeight + conn.outWeight;
  }
  const avgConnectivity =
    connectivityMap.size > 0 ? totalConnectivity / connectivityMap.size : 1;

  // 類似度計算用のembeddings — 一括で全ノートの統計を計算（O(N)でループ1回）
  let allSimStats = new Map<string, { avgSimilarity: number; maxSimilarity: number }>();
  if (includeSimilarity) {
    const allEmbeddings = await getAllEmbeddings();
    allSimStats = calculateAllSimilarityStats(allEmbeddings);
  }

  // 各ノートの孤立度を計算
  const isolationInfos: IsolationInfo[] = [];

  for (const note of notes) {
    const conn = connectivityMap.get(note.id) || {
      inDegree: 0,
      outDegree: 0,
      inWeight: 0,
      outWeight: 0,
    };

    const connectivity = conn.inWeight + conn.outWeight;

    // 孤立度 = 1 - (接続度 / 平均接続度)
    // 接続度が平均より低いほど孤立度が高い
    const normalizedConnectivity =
      avgConnectivity > 0 ? Math.min(connectivity / avgConnectivity, 1) : 0;
    const isolationScore = 1 - normalizedConnectivity;

    // 類似度統計
    const simStats = allSimStats.get(note.id) || { avgSimilarity: 0, maxSimilarity: 0 };

    isolationInfos.push({
      noteId: note.id,
      title: note.title,
      category: note.category,
      clusterId: note.cluster_id,
      isolationScore: Math.round(isolationScore * 1000) / 1000,
      inDegree: conn.inDegree,
      outDegree: conn.outDegree,
      inWeight: Math.round(conn.inWeight * 1000) / 1000,
      outWeight: Math.round(conn.outWeight * 1000) / 1000,
      connectivity: Math.round(normalizedConnectivity * 1000) / 1000,
      avgSimilarity: Math.round(simStats.avgSimilarity * 1000) / 1000,
      maxSimilarity: Math.round(simStats.maxSimilarity * 1000) / 1000,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    });
  }

  // 孤立度でソート（高い順）
  isolationInfos.sort((a, b) => b.isolationScore - a.isolationScore);

  // 閾値以上のものをフィルタリング
  const filtered = isolationInfos.filter(
    (info) => info.isolationScore >= threshold
  );

  return filtered.slice(0, limit);
}

/**
 * 特定ノートの孤立度を取得
 */
export async function getIsolationScore(noteId: string): Promise<IsolationInfo | null> {
  const noteData = await isolationRepo.findNoteById(noteId);

  if (!noteData) {
    return null;
  }

  const connectivityMap = await calculateConnectivity();

  // 平均接続度
  let totalConnectivity = 0;
  for (const conn of connectivityMap.values()) {
    totalConnectivity += conn.inWeight + conn.outWeight;
  }
  const avgConnectivity =
    connectivityMap.size > 0 ? totalConnectivity / connectivityMap.size : 1;

  const conn = connectivityMap.get(noteData.id) || {
    inDegree: 0,
    outDegree: 0,
    inWeight: 0,
    outWeight: 0,
  };

  const connectivity = conn.inWeight + conn.outWeight;
  const normalizedConnectivity =
    avgConnectivity > 0 ? Math.min(connectivity / avgConnectivity, 1) : 0;
  const isolationScore = 1 - normalizedConnectivity;

  // 対象ノートのembeddingだけ取得し、全embeddingsで類似度計算
  const targetEmbedding = await getEmbedding(noteData.id);
  let simStats = { avgSimilarity: 0, maxSimilarity: 0 };
  if (targetEmbedding) {
    const allEmbeddings = await getAllEmbeddings();
    simStats = calculateSimilarityStats(noteData.id, targetEmbedding, allEmbeddings);
  }

  return {
    noteId: noteData.id,
    title: noteData.title,
    category: noteData.category,
    clusterId: noteData.cluster_id,
    isolationScore: Math.round(isolationScore * 1000) / 1000,
    inDegree: conn.inDegree,
    outDegree: conn.outDegree,
    inWeight: Math.round(conn.inWeight * 1000) / 1000,
    outWeight: Math.round(conn.outWeight * 1000) / 1000,
    connectivity: Math.round(normalizedConnectivity * 1000) / 1000,
    avgSimilarity: Math.round(simStats.avgSimilarity * 1000) / 1000,
    maxSimilarity: Math.round(simStats.maxSimilarity * 1000) / 1000,
    createdAt: noteData.created_at,
    updatedAt: noteData.updated_at,
  };
}

/**
 * 孤立度の統計情報を取得
 */
export async function getIsolationStats(
  isolationThreshold: number = 0.7
): Promise<IsolationStats> {
  const notes = await isolationRepo.findAllNoteIds();
  const totalNotes = notes.length;

  if (totalNotes === 0) {
    return {
      totalNotes: 0,
      avgConnectivity: 0,
      avgIsolationScore: 0,
      isolatedCount: 0,
      wellConnectedCount: 0,
      noEdgesCount: 0,
    };
  }

  const connectivityMap = await calculateConnectivity();

  let totalConnectivity = 0;
  let totalIsolationScore = 0;
  let isolatedCount = 0;
  let wellConnectedCount = 0;
  let noEdgesCount = 0;

  for (const conn of connectivityMap.values()) {
    totalConnectivity += conn.inWeight + conn.outWeight;
  }
  const avgConnectivity =
    connectivityMap.size > 0 ? totalConnectivity / connectivityMap.size : 0;

  for (const note of notes) {
    const conn = connectivityMap.get(note.id);
    if (!conn) {
      noEdgesCount++;
      totalIsolationScore += 1; // エッジなし = 完全に孤立
      isolatedCount++;
      continue;
    }

    const connectivity = conn.inWeight + conn.outWeight;
    const normalizedConnectivity =
      avgConnectivity > 0 ? Math.min(connectivity / avgConnectivity, 1) : 0;
    const isolationScore = 1 - normalizedConnectivity;

    totalIsolationScore += isolationScore;

    if (isolationScore >= isolationThreshold) {
      isolatedCount++;
    }
    if (isolationScore < 0.3) {
      wellConnectedCount++;
    }
  }

  return {
    totalNotes,
    avgConnectivity: Math.round(avgConnectivity * 1000) / 1000,
    avgIsolationScore: Math.round((totalIsolationScore / totalNotes) * 1000) / 1000,
    isolatedCount,
    wellConnectedCount,
    noEdgesCount,
  };
}

/**
 * 孤立ノートに対する統合提案を生成
 * （類似度が高いノートを候補として提示）
 */
export async function getIntegrationSuggestions(
  noteId: string,
  limit: number = 5
): Promise<
  Array<{
    noteId: string;
    title: string;
    similarity: number;
    reason: string;
  }>
> {
  const targetEmbedding = await getEmbedding(noteId);
  if (!targetEmbedding) {
    return [];
  }

  const allEmbeddings = await getAllEmbeddings();

  // 他のノートとの類似度を計算
  const similarities: Array<{
    noteId: string;
    similarity: number;
  }> = [];

  for (const { noteId: otherId, embedding } of allEmbeddings) {
    if (otherId === noteId) continue;
    const sim = cosineSimilarity(targetEmbedding, embedding);
    similarities.push({ noteId: otherId, similarity: sim });
  }

  // 類似度でソート
  similarities.sort((a, b) => b.similarity - a.similarity);

  // 上位のノートを取得
  const topSimilar = similarities.slice(0, limit);
  const noteIds = topSimilar.map((s) => s.noteId);

  if (noteIds.length === 0) {
    return [];
  }

  // ノート情報を取得
  const notesInfo = await isolationRepo.findNotesByIds(noteIds);

  const noteMap = new Map(notesInfo.map((n) => [n.id, n.title]));

  return topSimilar.map((s) => ({
    noteId: s.noteId,
    title: noteMap.get(s.noteId) || "Unknown",
    similarity: Math.round(s.similarity * 1000) / 1000,
    reason:
      s.similarity > 0.8
        ? "非常に高い類似度 - 統合を検討"
        : s.similarity > 0.6
          ? "高い類似度 - 関連付けを検討"
          : "中程度の類似度 - 参照リンクを検討",
  }));
}
