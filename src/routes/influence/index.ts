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
import {
  analyzeCausality,
  analyzeCausalRelations,
  analyzeInterventionEffect,
  analyzeCounterfactual,
  testGrangerCausality,
  getGlobalCausalSummary,
} from "../../services/influence/causalInference";
import { findNoteById } from "../../repositories/notesRepo";
import { DECAY_PRESETS, calculateHalfLife } from "../../services/timeDecay";
import { getOrCompute, generateCacheKey } from "../../services/cache";

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

// ============================================================
// v5.11 因果推論エンドポイント
// ============================================================

/**
 * GET /api/influence/causal/note/:noteId
 * 特定ノートの総合因果分析
 */
influenceRoute.get("/causal/note/:noteId", async (c) => {
  const noteId = c.req.param("noteId");

  const analysis = await analyzeCausality(noteId);

  return c.json({
    noteId: analysis.noteId,
    grangerCausality: {
      causes: analysis.grangerCausality.causes,
      causedBy: analysis.grangerCausality.causedBy,
      bidirectional: analysis.grangerCausality.bidirectional,
    },
    interventionEffect: {
      clusterDriftAcceleration: analysis.interventionEffect.clusterDriftAcceleration,
      affectedNotes: analysis.interventionEffect.affectedNotes,
      significance: analysis.interventionEffect.significance,
      effectSize: analysis.interventionEffect.effectSize,
      timeToEffect: analysis.interventionEffect.timeToEffect,
    },
    counterfactual: {
      title: analysis.counterfactual.title,
      missingConcepts: analysis.counterfactual.missingConcepts,
      alternativePath: analysis.counterfactual.alternativePath,
      impactScore: analysis.counterfactual.impactScore,
      pivotProbability: analysis.counterfactual.pivotProbability,
      dependentNotes: analysis.counterfactual.dependentNotes.length,
    },
    insight: analysis.insight,
  });
});

/**
 * GET /api/influence/causal/note/:noteId/granger
 * 特定ノートのGranger因果関係
 */
influenceRoute.get("/causal/note/:noteId/granger", async (c) => {
  const noteId = c.req.param("noteId");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  const relations = await analyzeCausalRelations(noteId, limit);

  // ノート情報を付加
  const enrichCauses = await Promise.all(
    relations.causes.map(async (id) => {
      const note = await findNoteById(id);
      return { noteId: id, title: note?.title ?? "Unknown" };
    })
  );

  const enrichCausedBy = await Promise.all(
    relations.causedBy.map(async (id) => {
      const note = await findNoteById(id);
      return { noteId: id, title: note?.title ?? "Unknown" };
    })
  );

  const enrichBidirectional = await Promise.all(
    relations.bidirectional.map(async (id) => {
      const note = await findNoteById(id);
      return { noteId: id, title: note?.title ?? "Unknown" };
    })
  );

  return c.json({
    noteId,
    causes: enrichCauses,
    causedBy: enrichCausedBy,
    bidirectional: enrichBidirectional,
    summary: {
      totalCauses: relations.causes.length,
      totalCausedBy: relations.causedBy.length,
      totalBidirectional: relations.bidirectional.length,
    },
  });
});

/**
 * GET /api/influence/causal/note/:noteId/intervention
 * 特定ノートの介入効果分析
 */
influenceRoute.get("/causal/note/:noteId/intervention", async (c) => {
  const noteId = c.req.param("noteId");

  const effect = await analyzeInterventionEffect(noteId);

  return c.json({
    noteId: effect.noteId,
    clusterDriftAcceleration: effect.clusterDriftAcceleration,
    affectedNotes: effect.affectedNotes,
    avgDriftIncrease: effect.avgDriftIncrease,
    significance: effect.significance,
    effectSize: effect.effectSize,
    timeToEffect: effect.timeToEffect,
    interpretation: interpretInterventionEffect(effect),
  });
});

/**
 * 介入効果の解釈を生成
 */
function interpretInterventionEffect(effect: {
  clusterDriftAcceleration: number;
  significance: number;
  effectSize: number;
}): string {
  if (effect.significance < 0.3) {
    return "統計的に有意な効果は検出されませんでした。";
  }

  if (effect.effectSize > 0.8) {
    return "非常に大きな効果がありました。このノートはクラスター全体の思考を大きく変化させました。";
  }

  if (effect.effectSize > 0.5) {
    return "中程度の効果がありました。周囲のノートに明確な影響を与えています。";
  }

  if (effect.effectSize > 0.2) {
    return "小さいながらも検出可能な効果がありました。";
  }

  return "効果は限定的でした。";
}

/**
 * GET /api/influence/causal/note/:noteId/counterfactual
 * 特定ノートの反実仮想分析
 */
influenceRoute.get("/causal/note/:noteId/counterfactual", async (c) => {
  const noteId = c.req.param("noteId");

  const counterfactual = await analyzeCounterfactual(noteId);

  // 依存ノートの情報を付加
  const dependentNotesWithInfo = await Promise.all(
    counterfactual.dependentNotes.slice(0, 5).map(async (id) => {
      const note = await findNoteById(id);
      return { noteId: id, title: note?.title ?? "Unknown" };
    })
  );

  return c.json({
    noteId: counterfactual.noteId,
    title: counterfactual.title,
    missingConcepts: counterfactual.missingConcepts,
    alternativePath: counterfactual.alternativePath,
    impactScore: counterfactual.impactScore,
    pivotProbability: counterfactual.pivotProbability,
    dependentNotes: dependentNotesWithInfo,
    totalDependentNotes: counterfactual.dependentNotes.length,
  });
});

/**
 * GET /api/influence/causal/test
 * 2つのノート間のGranger因果検定
 *
 * Query:
 * - source: ソースノートID
 * - target: ターゲットノートID
 * - lag: ラグ日数（デフォルト: 7）
 */
influenceRoute.get("/causal/test", async (c) => {
  const sourceNoteId = c.req.query("source");
  const targetNoteId = c.req.query("target");
  const lagParam = c.req.query("lag");
  const lag = lagParam ? parseInt(lagParam, 10) : 7;

  if (!sourceNoteId || !targetNoteId) {
    return c.json({ error: "source and target query parameters are required" }, 400);
  }

  if (isNaN(lag) || lag < 1 || lag > 30) {
    return c.json({ error: "lag must be between 1 and 30" }, 400);
  }

  const result = await testGrangerCausality(sourceNoteId, targetNoteId, lag);

  // ノート情報を取得
  const [sourceNote, targetNote] = await Promise.all([
    findNoteById(sourceNoteId),
    findNoteById(targetNoteId),
  ]);

  return c.json({
    source: {
      noteId: sourceNoteId,
      title: sourceNote?.title ?? "Unknown",
    },
    target: {
      noteId: targetNoteId,
      title: targetNote?.title ?? "Unknown",
    },
    lag,
    fStatistic: result.fStatistic,
    pValue: result.pValue,
    causalStrength: result.causalStrength,
    direction: result.direction,
    interpretation: interpretGrangerResult(result),
  });
});

/**
 * Granger因果検定の結果を解釈
 */
function interpretGrangerResult(result: {
  causalStrength: number;
  direction: string;
  pValue: number;
}): string {
  if (result.direction === "bidirectional") {
    return "双方向の因果関係が検出されました。互いに影響し合っています。";
  }

  if (result.direction === "unidirectional") {
    if (result.causalStrength > 0.7) {
      return "強い一方向の因果関係が検出されました。ソースがターゲットに明確に影響しています。";
    }
    return "一方向の因果関係が検出されました。";
  }

  if (result.pValue > 0.1) {
    return "因果関係は検出されませんでした。相関があっても因果ではない可能性があります。";
  }

  return "弱い因果関係の可能性があります。より多くのデータが必要です。";
}

/**
 * GET /api/influence/causal/summary
 * 全体の因果関係サマリー
 */
influenceRoute.get("/causal/summary", async (c) => {
  const cacheKey = generateCacheKey("influence_causal_summary", {});
  const summary = await getOrCompute(
    cacheKey,
    "influence_causal_summary",
    () => getGlobalCausalSummary()
  );

  // Top influencers にノート情報を付加
  const enrichedInfluencers = await Promise.all(
    summary.topCausalInfluencers.map(async (inf) => {
      const note = await findNoteById(inf.noteId);
      return {
        ...inf,
        title: note?.title ?? "Unknown",
      };
    })
  );

  return c.json({
    overview: {
      totalCausalPairs: summary.totalCausalPairs,
      strongCausalRelations: summary.strongCausalRelations,
      avgCausalStrength: summary.avgCausalStrength,
    },
    topCausalInfluencers: enrichedInfluencers,
    pivotNotes: summary.pivotNotes,
    insight: generateCausalSummaryInsight(summary),
  });
});

/**
 * 因果サマリーのインサイトを生成
 */
function generateCausalSummaryInsight(summary: {
  totalCausalPairs: number;
  strongCausalRelations: number;
  avgCausalStrength: number;
  pivotNotes: Array<{ noteId: string; title: string; pivotProbability: number }>;
}): string {
  if (summary.totalCausalPairs === 0) {
    return "因果関係の分析には十分なデータがありません。";
  }

  const parts: string[] = [];

  const strongRatio = summary.strongCausalRelations / summary.totalCausalPairs;
  if (strongRatio > 0.3) {
    parts.push("思考間の因果的つながりが強く、体系的な知識構造が形成されています。");
  } else if (strongRatio > 0.1) {
    parts.push("中程度の因果的つながりがあり、知識が徐々に連携しています。");
  }

  if (summary.pivotNotes.length > 0) {
    const topPivot = summary.pivotNotes[0];
    parts.push(`「${topPivot.title}」が思考の転換点として重要な役割を果たしています。`);
  }

  if (parts.length === 0) {
    return `${summary.totalCausalPairs}件の因果関係が検出されています。`;
  }

  return parts.join(" ");
}
