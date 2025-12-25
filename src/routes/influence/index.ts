import { Hono } from "hono";
import {
  getInfluencersOf,
  getInfluencersOfWithDecay,
  getInfluencedBy,
  getInfluencedByWithDecay,
  getInfluenceStats,
  getAllInfluenceEdges,
  getAllInfluenceEdgesWithDecay,
  getInfluenceDecayStats,
} from "../../services/influence/influenceService";
import { findNoteById } from "../../repositories/notesRepo";
import { DECAY_PRESETS, calculateHalfLife } from "../../services/timeDecay";

export const influenceRoute = new Hono();

/**
 * GET /api/influence/stats
 * Concept Influence Graph 全体の統計
 */
influenceRoute.get("/stats", async (c) => {
  const stats = await getInfluenceStats();

  return c.json({
    totalEdges: stats.totalEdges,
    avgWeight: Math.round(stats.avgWeight * 10000) / 10000,
    maxWeight: Math.round(stats.maxWeight * 10000) / 10000,
    topInfluencedNotes: stats.topInfluencedNotes,
    topInfluencers: stats.topInfluencers,
  });
});

/**
 * GET /api/influence/note/:noteId/influencers
 * 特定ノートに影響を与えているノート一覧
 */
influenceRoute.get("/note/:noteId/influencers", async (c) => {
  const noteId = c.req.param("noteId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  const edges = await getInfluencersOf(noteId, limit);

  // ノート情報を取得
  const enrichedEdges = await Promise.all(
    edges.map(async (edge) => {
      const note = await findNoteById(edge.sourceNoteId);
      return {
        ...edge,
        sourceNote: note
          ? { id: note.id, title: note.title, clusterId: note.clusterId }
          : null,
      };
    })
  );

  return c.json({
    noteId,
    influencers: enrichedEdges,
    count: enrichedEdges.length,
  });
});

/**
 * GET /api/influence/note/:noteId/influenced
 * 特定ノートが影響を与えているノート一覧
 */
influenceRoute.get("/note/:noteId/influenced", async (c) => {
  const noteId = c.req.param("noteId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  const edges = await getInfluencedBy(noteId, limit);

  // ノート情報を取得
  const enrichedEdges = await Promise.all(
    edges.map(async (edge) => {
      const note = await findNoteById(edge.targetNoteId);
      return {
        ...edge,
        targetNote: note
          ? { id: note.id, title: note.title, clusterId: note.clusterId }
          : null,
      };
    })
  );

  return c.json({
    noteId,
    influenced: enrichedEdges,
    count: enrichedEdges.length,
  });
});

/**
 * GET /api/influence/note/:noteId
 * 特定ノートの影響関係（双方向）
 */
influenceRoute.get("/note/:noteId", async (c) => {
  const noteId = c.req.param("noteId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  const [influencers, influenced] = await Promise.all([
    getInfluencersOf(noteId, limit),
    getInfluencedBy(noteId, limit),
  ]);

  // ノート情報を取得
  const note = await findNoteById(noteId);

  // 影響度の合計を計算
  const totalIncomingInfluence = influencers.reduce((sum, e) => sum + e.weight, 0);
  const totalOutgoingInfluence = influenced.reduce((sum, e) => sum + e.weight, 0);

  // influencers にノート情報を付加
  const enrichedInfluencers = await Promise.all(
    influencers.slice(0, 5).map(async (edge) => {
      const sourceNote = await findNoteById(edge.sourceNoteId);
      return {
        ...edge,
        sourceNote: sourceNote
          ? { id: sourceNote.id, title: sourceNote.title, clusterId: sourceNote.clusterId }
          : null,
      };
    })
  );

  // influenced にノート情報を付加
  const enrichedInfluenced = await Promise.all(
    influenced.slice(0, 5).map(async (edge) => {
      const targetNote = await findNoteById(edge.targetNoteId);
      return {
        ...edge,
        targetNote: targetNote
          ? { id: targetNote.id, title: targetNote.title, clusterId: targetNote.clusterId }
          : null,
      };
    })
  );

  return c.json({
    note: note
      ? { id: note.id, title: note.title, clusterId: note.clusterId }
      : null,
    summary: {
      incomingEdges: influencers.length,
      outgoingEdges: influenced.length,
      totalIncomingInfluence: Math.round(totalIncomingInfluence * 10000) / 10000,
      totalOutgoingInfluence: Math.round(totalOutgoingInfluence * 10000) / 10000,
    },
    influencers: enrichedInfluencers,
    influenced: enrichedInfluenced,
  });
});

/**
 * GET /api/influence/summary
 * GPT向けサマリー
 */
influenceRoute.get("/summary", async (c) => {
  const stats = await getInfluenceStats();

  // 最も影響を受けたノートの詳細を取得
  const topInfluencedDetails = await Promise.all(
    stats.topInfluencedNotes.slice(0, 3).map(async (item) => {
      const note = await findNoteById(item.noteId);
      return {
        noteId: item.noteId,
        title: note?.title ?? "Unknown",
        clusterId: note?.clusterId ?? null,
        edgeCount: item.edgeCount,
        totalInfluence: Math.round(item.totalInfluence * 10000) / 10000,
      };
    })
  );

  // 最も影響を与えているノートの詳細を取得
  const topInfluencerDetails = await Promise.all(
    stats.topInfluencers.slice(0, 3).map(async (item) => {
      const note = await findNoteById(item.noteId);
      return {
        noteId: item.noteId,
        title: note?.title ?? "Unknown",
        clusterId: note?.clusterId ?? null,
        edgeCount: item.edgeCount,
        totalInfluence: Math.round(item.totalInfluence * 10000) / 10000,
      };
    })
  );

  // インサイトを生成
  const insight = generateInsight(stats);

  return c.json({
    overview: {
      totalEdges: stats.totalEdges,
      avgWeight: Math.round(stats.avgWeight * 10000) / 10000,
      maxWeight: Math.round(stats.maxWeight * 10000) / 10000,
    },
    topInfluenced: topInfluencedDetails,
    topInfluencers: topInfluencerDetails,
    insight,
  });
});

/**
 * GET /api/influence/graph
 * グラフ全体のノードとエッジを取得（可視化用）
 */
influenceRoute.get("/graph", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 200;

  const edges = await getAllInfluenceEdges(limit);

  // エッジに含まれるノートIDを収集
  const noteIds = new Set<string>();
  edges.forEach((edge) => {
    noteIds.add(edge.sourceNoteId);
    noteIds.add(edge.targetNoteId);
  });

  // ノート情報を取得
  const notes = await Promise.all(
    Array.from(noteIds).map(async (noteId) => {
      const note = await findNoteById(noteId);
      return note
        ? { id: note.id, title: note.title, clusterId: note.clusterId }
        : null;
    })
  );

  const validNotes = notes.filter((n) => n !== null);

  return c.json({
    nodes: validNotes,
    edges: edges.map((e) => ({
      source: e.sourceNoteId,
      target: e.targetNoteId,
      weight: e.weight,
    })),
    stats: {
      nodeCount: validNotes.length,
      edgeCount: edges.length,
    },
  });
});

// ============================================================
// v5.7 時間減衰対応エンドポイント
// ============================================================

/**
 * 減衰プリセット名からλ値を取得
 */
function getDecayLambda(preset?: string): number {
  if (!preset) return DECAY_PRESETS.balanced;
  if (preset in DECAY_PRESETS) {
    return DECAY_PRESETS[preset as keyof typeof DECAY_PRESETS];
  }
  const parsed = parseFloat(preset);
  if (!isNaN(parsed) && parsed > 0) return parsed;
  return DECAY_PRESETS.balanced;
}

/**
 * GET /api/influence/decay/stats
 * 時間減衰統計を取得 (v5.7)
 */
influenceRoute.get("/decay/stats", async (c) => {
  const decayParam = c.req.query("decay");
  const lambda = getDecayLambda(decayParam);

  const stats = await getInfluenceDecayStats(lambda);

  return c.json({
    lambda,
    halfLifeDays: Math.round(calculateHalfLife(lambda) * 10) / 10,
    ...stats,
  });
});

/**
 * GET /api/influence/decay/graph
 * 時間減衰適用済みグラフを取得 (v5.7)
 */
influenceRoute.get("/decay/graph", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 200;
  const decayParam = c.req.query("decay");
  const lambda = getDecayLambda(decayParam);

  const edges = await getAllInfluenceEdgesWithDecay({ limit, lambda });

  // エッジに含まれるノートIDを収集
  const noteIds = new Set<string>();
  edges.forEach((edge) => {
    noteIds.add(edge.sourceNoteId);
    noteIds.add(edge.targetNoteId);
  });

  // ノート情報を取得
  const notes = await Promise.all(
    Array.from(noteIds).map(async (noteId) => {
      const note = await findNoteById(noteId);
      return note
        ? { id: note.id, title: note.title, clusterId: note.clusterId }
        : null;
    })
  );

  const validNotes = notes.filter((n) => n !== null);

  return c.json({
    decay: {
      lambda,
      halfLifeDays: Math.round(calculateHalfLife(lambda) * 10) / 10,
    },
    nodes: validNotes,
    edges: edges.map((e) => ({
      source: e.sourceNoteId,
      target: e.targetNoteId,
      weight: e.weight,
      decayedWeight: e.decayedWeight,
      daysSinceCreation: e.daysSinceCreation,
      decayFactor: e.decayFactor,
    })),
    stats: {
      nodeCount: validNotes.length,
      edgeCount: edges.length,
    },
  });
});

/**
 * GET /api/influence/decay/note/:noteId/influencers
 * 時間減衰適用済みの影響元ノート一覧 (v5.7)
 */
influenceRoute.get("/decay/note/:noteId/influencers", async (c) => {
  const noteId = c.req.param("noteId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const decayParam = c.req.query("decay");
  const lambda = getDecayLambda(decayParam);

  const edges = await getInfluencersOfWithDecay(noteId, { limit, lambda });

  const enrichedEdges = await Promise.all(
    edges.map(async (edge) => {
      const note = await findNoteById(edge.sourceNoteId);
      return {
        ...edge,
        sourceNote: note
          ? { id: note.id, title: note.title, clusterId: note.clusterId }
          : null,
      };
    })
  );

  return c.json({
    noteId,
    decay: {
      lambda,
      halfLifeDays: Math.round(calculateHalfLife(lambda) * 10) / 10,
    },
    influencers: enrichedEdges,
    count: enrichedEdges.length,
  });
});

/**
 * GET /api/influence/decay/note/:noteId/influenced
 * 時間減衰適用済みの影響先ノート一覧 (v5.7)
 */
influenceRoute.get("/decay/note/:noteId/influenced", async (c) => {
  const noteId = c.req.param("noteId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const decayParam = c.req.query("decay");
  const lambda = getDecayLambda(decayParam);

  const edges = await getInfluencedByWithDecay(noteId, { limit, lambda });

  const enrichedEdges = await Promise.all(
    edges.map(async (edge) => {
      const note = await findNoteById(edge.targetNoteId);
      return {
        ...edge,
        targetNote: note
          ? { id: note.id, title: note.title, clusterId: note.clusterId }
          : null,
      };
    })
  );

  return c.json({
    noteId,
    decay: {
      lambda,
      halfLifeDays: Math.round(calculateHalfLife(lambda) * 10) / 10,
    },
    influenced: enrichedEdges,
    count: enrichedEdges.length,
  });
});

/**
 * インサイトを生成
 */
function generateInsight(stats: {
  totalEdges: number;
  avgWeight: number;
  topInfluencedNotes: Array<{ noteId: string; edgeCount: number; totalInfluence: number }>;
  topInfluencers: Array<{ noteId: string; edgeCount: number; totalInfluence: number }>;
}): string {
  if (stats.totalEdges === 0) {
    return "まだ影響関係が構築されていません。ノートを更新すると影響グラフが成長します。";
  }

  const topInfluenced = stats.topInfluencedNotes[0];
  const topInfluencer = stats.topInfluencers[0];

  if (topInfluenced && topInfluencer) {
    if (topInfluenced.totalInfluence > 20) {
      return `思考の中心となるノートが形成されています。特に1つのノートに多くの影響が集中しており、知識の統合が進んでいます。`;
    }
    if (stats.avgWeight > 0.4) {
      return `ノート間の影響関係が強く、思考が密接に連携しています。統合的な理解が深まっています。`;
    }
    return `知識のネットワークが広がっています。さまざまなノートが互いに影響し合っています。`;
  }

  return `${stats.totalEdges}件の影響関係が存在します。`;
}
