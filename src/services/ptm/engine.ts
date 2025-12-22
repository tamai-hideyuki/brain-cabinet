/**
 * PTM Engine - Final Integration
 *
 * PTM Snapshot + Cluster Identity + Influence + Dynamics を統合
 * Lite版（GPT用）と Full版（研究用）の両方を提供
 */

import { generatePtmSnapshot } from "./snapshot";
import { computeClusterInfluenceFlow } from "./influence";
import { getAllClusterIdentities } from "../cluster/identity";
import type {
  PtmSnapshot,
  ClusterIdentity,
  ClusterRole,
  ClusterPersonaSummary,
  ClusterInteraction,
  CoachAdvice,
  PtmMetaStateLite,
  PtmMetaStateFull,
} from "./types";

// ============================================================
// クラスタの役割判定
// ============================================================

function determineClusterRole(
  identity: ClusterIdentity,
  interactions: ClusterInteraction[]
): ClusterRole {
  const { drift, influence, cohesion } = identity.identity;

  // Driver: drift contribution が高い（成長の主要源）
  if (drift.contribution > 0.3) {
    return "driver";
  }

  // Stabilizer: cohesion が高く、drift が低い（安定した基盤）
  if (cohesion > 0.8 && drift.contribution < 0.1 && influence.hubness > 0.5) {
    return "stabilizer";
  }

  // Bridge: 他クラスタへの影響と受ける影響の両方が存在
  const outgoing = interactions.filter((i) => i.source === identity.clusterId);
  const incoming = interactions.filter((i) => i.target === identity.clusterId);
  if (outgoing.length > 0 && incoming.length > 0) {
    return "bridge";
  }

  // Isolated: 相互作用が少ない
  return "isolated";
}

// ============================================================
// Coach Advice 生成
// ============================================================

function generateCoachAdvice(
  snapshot: PtmSnapshot,
  topClusters: ClusterPersonaSummary[]
): CoachAdvice {
  const { mode, season, state, trend, growthAngle } = snapshot;

  // Today's advice
  let today = "";
  if (state === "overheat") {
    today = "思考が過熱状態です。一度立ち止まって整理する時間を取りましょう。新しいインプットは控えめに。";
  } else if (state === "stagnation") {
    today = "思考が停滞しています。新しいテーマに触れてみましょう。異なる視点からのアプローチが効果的です。";
  } else if (mode === "exploration" && season === "broad_search") {
    today = "探索が広がっています。気になったテーマを1つ選んで深掘りしてみましょう。";
  } else if (mode === "consolidation" && season === "deep_focus") {
    const topCluster = topClusters.length > 0 ? topClusters[0] : null;
    if (topCluster) {
      today = `クラスタ${topCluster.clusterId}（${topCluster.keywords.slice(0, 2).join("・")}）に集中しています。関連するノート同士をつなげてみましょう。`;
    } else {
      today = "統合フェーズです。既存のノートを振り返り、つながりを見つけましょう。";
    }
  } else if (trend === "rising") {
    today = "良い成長リズムです。この調子で続けましょう。";
  } else {
    today = "安定した成長を続けています。今日も良いノートを書きましょう。";
  }

  // Tomorrow's advice
  let tomorrow = "";
  if (trend === "rising" && growthAngle > 15) {
    tomorrow = "成長角度が高いです。明日は少しペースを落として整理の時間を取ると良いでしょう。";
  } else if (trend === "falling") {
    tomorrow = "成長ペースが落ち着いています。明日は新しい刺激を取り入れてみましょう。";
  } else {
    const drivers = topClusters.filter((c) => c.role === "driver");
    if (drivers.length > 0) {
      tomorrow = `${drivers[0].keywords.slice(0, 2).join("・")}のクラスタが活発です。明日もこの領域を伸ばしていきましょう。`;
    } else {
      tomorrow = "明日は思考の整理に時間を使うと効果的です。";
    }
  }

  // Balance advice
  let balance = "";
  const driverCount = topClusters.filter((c) => c.role === "driver").length;
  const stabilizerCount = topClusters.filter((c) => c.role === "stabilizer").length;

  if (driverCount > 2 && stabilizerCount === 0) {
    balance = "成長に偏りがあります。基盤となる安定したクラスタを育てることも大切です。";
  } else if (stabilizerCount > 2 && driverCount === 0) {
    balance = "安定していますが、新しい成長領域を開拓しましょう。";
  } else {
    balance = "成長と安定のバランスが取れています。";
  }

  // Warning
  let warning: string | null = null;
  if (state === "overheat") {
    warning = "過熱状態：情報摂取を控え、既存の知識を整理することを推奨します。";
  } else if (state === "stagnation") {
    warning = "停滞状態：新しい刺激が必要です。異なるジャンルに触れてみてください。";
  }

  return { today, tomorrow, balance, warning };
}

// ============================================================
// Interaction 変換
// ============================================================

function convertToInteractions(
  flowData: Array<{ source: number; target: number; weight: number }>
): ClusterInteraction[] {
  return flowData.map((flow) => ({
    source: flow.source,
    target: flow.target,
    weight: flow.weight,
    type: flow.weight > 1.0 ? "strong" : flow.weight > 0.3 ? "moderate" : "weak",
  }));
}

// ============================================================
// Lite 版生成
// ============================================================

export async function generateMetaStateLite(
  date: string = new Date().toISOString().split("T")[0]
): Promise<PtmMetaStateLite> {
  // データ取得
  const [snapshot, identities, flowData] = await Promise.all([
    generatePtmSnapshot(date),
    getAllClusterIdentities(),
    computeClusterInfluenceFlow(),
  ]);

  const interactions = convertToInteractions(flowData);

  // クラスタを PersonaSummary に変換
  const clusterSummaries: ClusterPersonaSummary[] = identities.map((id) => {
    const role = determineClusterRole(id, interactions);
    return {
      clusterId: id.clusterId,
      keywords: id.identity.keywords,
      noteCount: id.identity.noteCount,
      cohesion: id.identity.cohesion,
      role,
      drift: {
        contribution: id.identity.drift.contribution,
        trend: id.identity.drift.trend,
      },
      influence: {
        hubness: id.identity.influence.hubness,
        authority: id.identity.influence.authority,
      },
    };
  });

  // Top クラスタ（contribution順）
  const topClusters = [...clusterSummaries]
    .sort((a, b) => b.drift.contribution - a.drift.contribution)
    .slice(0, 5);

  // Coach advice
  const coach = generateCoachAdvice(snapshot, topClusters);

  return {
    date,
    mode: snapshot.mode,
    season: snapshot.season,
    state: snapshot.state,
    growthAngle: snapshot.growthAngle,
    trend: snapshot.trend,
    dominantCluster: snapshot.dominantCluster,
    topClusters,
    coach,
  };
}

// ============================================================
// Full 版生成
// ============================================================

export async function generateMetaStateFull(
  date: string = new Date().toISOString().split("T")[0]
): Promise<PtmMetaStateFull> {
  // データ取得
  const [snapshot, identities, flowData] = await Promise.all([
    generatePtmSnapshot(date),
    getAllClusterIdentities(),
    computeClusterInfluenceFlow(),
  ]);

  const interactions = convertToInteractions(flowData);

  // Role Map
  const roleMap: Record<number, ClusterRole> = {};
  const clusterSummaries: ClusterPersonaSummary[] = identities.map((id) => {
    const role = determineClusterRole(id, interactions);
    roleMap[id.clusterId] = role;
    return {
      clusterId: id.clusterId,
      keywords: id.identity.keywords,
      noteCount: id.identity.noteCount,
      cohesion: id.identity.cohesion,
      role,
      drift: {
        contribution: id.identity.drift.contribution,
        trend: id.identity.drift.trend,
      },
      influence: {
        hubness: id.identity.influence.hubness,
        authority: id.identity.influence.authority,
      },
    };
  });

  // Coach advice
  const topClusters = [...clusterSummaries]
    .sort((a, b) => b.drift.contribution - a.drift.contribution)
    .slice(0, 5);
  const coach = generateCoachAdvice(snapshot, topClusters);

  return {
    date,
    snapshot,
    clusters: identities,
    interactions,
    roleMap,
    coach,
  };
}
