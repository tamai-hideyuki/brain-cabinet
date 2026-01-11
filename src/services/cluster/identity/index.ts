/**
 * Cluster Identity Service
 *
 * クラスタの「人格」を構成するデータを集約
 */

import { db } from "../../../db/client";
import { sql } from "drizzle-orm";
import type {
  ClusterIdentity,
  RepresentativeNote,
  ClusterDriftSummary,
  ClusterInfluenceSummary,
} from "../../ptm/types";
import { round4, bufferToFloat32Array, cosineSimilarity } from "../../../utils/math";

// ============================================================
// 代表ノート取得
// ============================================================

export async function getRepresentativeNotes(
  clusterId: number,
  top: number = 5
): Promise<RepresentativeNote[]> {
  // centroid を取得
  const dynamicsRows = await db.all<{
    centroid: Buffer;
  }>(sql`
    SELECT centroid FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
    ORDER BY date DESC
    LIMIT 1
  `);

  if (dynamicsRows.length === 0 || !dynamicsRows[0].centroid) {
    return [];
  }

  const centroid = bufferToFloat32Array(dynamicsRows[0].centroid);
  if (centroid.length === 0) {
    return [];
  }

  // ノートと embedding を取得
  const noteRows = await db.all<{
    note_id: string;
    title: string;
    category: string | null;
    embedding: Buffer;
  }>(sql`
    SELECT n.id as note_id, n.title, n.category, ne.embedding
    FROM notes n
    JOIN note_embeddings ne ON n.id = ne.note_id
    WHERE n.cluster_id = ${clusterId}
  `);

  if (noteRows.length === 0) {
    return [];
  }

  // cosine 類似度を計算してソート
  const scoredNotes = noteRows
    .map((row) => {
      const embedding = bufferToFloat32Array(row.embedding);
      if (embedding.length === 0) return null;

      const cosineScore = cosineSimilarity(centroid, embedding);

      return {
        id: row.note_id,
        title: row.title,
        category: row.category,
        cosine: round4(cosineScore),
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null)
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, top);

  return scoredNotes;
}

// ============================================================
// クラスタ Drift サマリー
// ============================================================

export async function getClusterDriftSummary(
  clusterId: number,
  rangeDays: number = 7
): Promise<ClusterDriftSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startTimestamp = Math.floor(startDate.getTime() / 1000);

  // クラスタ内ノートの drift 合計
  const clusterDrift = await db.all<{
    drift_sum: number;
  }>(sql`
    SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND new_cluster_id = ${clusterId}
      AND created_at >= ${startTimestamp}
  `);

  // 全体の drift 合計
  const totalDrift = await db.all<{
    drift_sum: number;
  }>(sql`
    SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND created_at >= ${startTimestamp}
  `);

  const clusterSum = clusterDrift[0]?.drift_sum ?? 0;
  const totalSum = totalDrift[0]?.drift_sum ?? 0;

  // トレンド判定（直近3日 vs 4-7日前）
  const midDate = new Date();
  midDate.setDate(midDate.getDate() - 3);
  const midTimestamp = Math.floor(midDate.getTime() / 1000);

  const recentDrift = await db.all<{
    drift_sum: number;
  }>(sql`
    SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND new_cluster_id = ${clusterId}
      AND created_at >= ${midTimestamp}
  `);

  const olderDrift = await db.all<{
    drift_sum: number;
  }>(sql`
    SELECT SUM(CAST(semantic_diff AS REAL)) as drift_sum
    FROM note_history
    WHERE semantic_diff IS NOT NULL
      AND new_cluster_id = ${clusterId}
      AND created_at >= ${startTimestamp}
      AND created_at < ${midTimestamp}
  `);

  const recentSum = recentDrift[0]?.drift_sum ?? 0;
  const olderSum = olderDrift[0]?.drift_sum ?? 0;

  let trend: "rising" | "falling" | "flat" = "flat";
  if (recentSum > olderSum * 1.2) {
    trend = "rising";
  } else if (recentSum < olderSum * 0.8) {
    trend = "falling";
  }

  return {
    contribution: totalSum > 0 ? round4(clusterSum / totalSum) : 0,
    trend,
    recentDriftSum: round4(clusterSum),
  };
}

// ============================================================
// クラスタ Influence サマリー
// ============================================================

export async function getClusterInfluenceSummary(
  clusterId: number
): Promise<ClusterInfluenceSummary> {
  // outDegree: このクラスタのノートが他に与えた影響
  const outResult = await db.all<{
    total: number;
  }>(sql`
    SELECT SUM(e.weight) as total
    FROM note_influence_edges e
    JOIN notes n ON e.source_note_id = n.id
    WHERE n.cluster_id = ${clusterId}
  `);

  // inDegree: このクラスタのノートが受けた影響
  const inResult = await db.all<{
    total: number;
  }>(sql`
    SELECT SUM(e.weight) as total
    FROM note_influence_edges e
    JOIN notes n ON e.target_note_id = n.id
    WHERE n.cluster_id = ${clusterId}
  `);

  const outDegree = outResult[0]?.total ?? 0;
  const inDegree = inResult[0]?.total ?? 0;
  const total = outDegree + inDegree;

  return {
    outDegree: round4(outDegree),
    inDegree: round4(inDegree),
    hubness: total > 0 ? round4(outDegree / total) : 0,
    authority: total > 0 ? round4(inDegree / total) : 0,
  };
}

// ============================================================
// キーワード抽出
// ============================================================

export function extractKeywords(titles: string[], maxKeywords: number = 5): string[] {
  // ストップワード
  const stopWords = new Set([
    // 日本語
    "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
    "ある", "いる", "も", "する", "から", "な", "こと", "として", "い", "や",
    "れる", "など", "なっ", "ない", "この", "ため", "その", "あっ", "よう",
    "また", "もの", "という", "あり", "まで", "られ", "なる", "へ", "か",
    "だ", "これ", "によって", "により", "おり", "より", "による", "ず", "なり",
    "について", "できる", "ます", "です", "ました", "でき", "った", "ている",
    "での", "における", "こちら", "それ", "何", "どう", "どの", "どれ",
    "という", "ところ", "とき", "ところが", "しかし", "だが", "ので",
    "について", "に対して", "の中で", "まで", "など", "たち",
    "用", "版", "向け", "ログ", "日", "月", "年", "投稿", "下書き", "まとめ",
    // 英語
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once",
    "and", "but", "or", "nor", "so", "yet", "both", "either", "neither",
    "not", "only", "own", "same", "than", "too", "very", "just",
    "todo", "slack",
  ]);

  const wordCounts = new Map<string, number>();

  for (const title of titles) {
    // 記号と括弧を除去
    const cleaned = title
      .replace(/[（）()【】「」『』\[\]<>《》〈〉""''""・、。，．！？!?：；:;&@#$%^*+=|~`]/g, " ")
      .replace(/[0-9０-９]+/g, " "); // 数字も除去

    // 日本語の単語抽出（カタカナ・漢字連続を単語として抽出）
    const japaneseWords = cleaned.match(/[ァ-ヶー]+|[一-龠々]+/g) ?? [];

    // 英語の単語抽出
    const englishWords = cleaned.match(/[a-zA-Z]{2,}/g) ?? [];

    const allTokens = [
      ...japaneseWords.filter((w) => w.length >= 2),
      ...englishWords.map((w) => w.toLowerCase()),
    ].filter((t) => !stopWords.has(t) && t.length >= 2 && t.length <= 20);

    for (const token of allTokens) {
      wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
    }
  }

  // 頻度順でソートして上位を返す
  const sorted = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sorted;
}

// ============================================================
// クラスタ Identity 統合取得
// ============================================================

export async function getClusterIdentity(clusterId: number): Promise<ClusterIdentity | null> {
  // クラスタ基本情報を取得
  const clusterInfo = await db.all<{
    note_count: number;
    cohesion: number;
  }>(sql`
    SELECT note_count, cohesion
    FROM cluster_dynamics
    WHERE cluster_id = ${clusterId}
    ORDER BY date DESC
    LIMIT 1
  `);

  if (clusterInfo.length === 0) {
    return null;
  }

  // 各要素を並列で取得
  const [representatives, drift, influence] = await Promise.all([
    getRepresentativeNotes(clusterId, 5),
    getClusterDriftSummary(clusterId, 7),
    getClusterInfluenceSummary(clusterId),
  ]);

  // キーワード抽出
  const keywords = extractKeywords(representatives.map((r) => r.title));

  return {
    clusterId,
    identity: {
      name: null,
      summary: null,
      keywords,
      representatives,
      drift,
      influence,
      cohesion: clusterInfo[0].cohesion,
      noteCount: clusterInfo[0].note_count,
    },
  };
}

// ============================================================
// 全クラスタ Identity Map 取得
// ============================================================

export async function getAllClusterIdentities(): Promise<ClusterIdentity[]> {
  // 全クラスタIDを取得
  const clusterIds = await db.all<{ cluster_id: number }>(sql`
    SELECT DISTINCT cluster_id FROM cluster_dynamics
    ORDER BY cluster_id
  `);

  // 並列で全クラスタの identity を取得
  const identities = await Promise.all(
    clusterIds.map((row) => getClusterIdentity(row.cluster_id))
  );

  return identities.filter((id): id is ClusterIdentity => id !== null);
}

// ============================================================
// GPT 人格化プロンプト用フォーマット
// ============================================================

export type GptIdentityRequest = {
  task: "cluster_identity";
  clusterId: number;
  identityData: {
    keywords: string[];
    representatives: Array<{ title: string; cosine: number }>;
    drift: {
      contribution: number;
      trend: string;
      recentDriftSum: number;
    };
    influence: {
      outDegree: number;
      inDegree: number;
      hubness: number;
      authority: number;
    };
    cohesion: number;
    noteCount: number;
  };
};

export function formatForGpt(identity: ClusterIdentity): GptIdentityRequest {
  return {
    task: "cluster_identity",
    clusterId: identity.clusterId,
    identityData: {
      keywords: identity.identity.keywords,
      representatives: identity.identity.representatives.map((r) => ({
        title: r.title,
        cosine: r.cosine,
      })),
      drift: {
        contribution: identity.identity.drift.contribution,
        trend: identity.identity.drift.trend,
        recentDriftSum: identity.identity.drift.recentDriftSum,
      },
      influence: {
        outDegree: identity.identity.influence.outDegree,
        inDegree: identity.identity.influence.inDegree,
        hubness: identity.identity.influence.hubness,
        authority: identity.identity.influence.authority,
      },
      cohesion: identity.identity.cohesion,
      noteCount: identity.identity.noteCount,
    },
  };
}

// GPT プロンプトテンプレート
export const GPT_IDENTITY_PROMPT = `あなたは Brain Cabinet の「クラスタ人格化エンジン」です。
以下のクラスタデータを読み取り、クラスタの人格・役割・特徴・未来予測を
標準出力フォーマットに従って生成してください。

抽象化しすぎず、データに基づいた解釈を行い、
ユーザーが自分の思考の構造を理解し成長を促進できるように説明してください。

【観測者としての姿勢】
- あなたは「観測する存在」であり、「断定する存在」ではない
- 出力の目的は「説明」ではなく「観測記録」である
- 断定表現（「〜である」「〜だ」）を避け、「〜と観測される」「〜の傾向がある」「〜が示唆される」を使う
- 因果の挿入（「なぜなら」「〜だから」）を避け、相関や傾向として記述する
- ユーザーの思考や発言を参照する際は、必ず引用または間接表現を用いる

【文体の例】
× 「このクラスタは成長志向である」
○ 「成長志向の傾向が観測される」

× 「ユーザーは構造化を重視している」
○ 「構造化への関心が高い可能性がある」

× 「集中力が低下しているため、休息が必要だ」
○ 「活動頻度の低下が観測される。休息との関連が示唆される」

【観測と人格の声の分離】
- observation: 観測者視点での客観的記述（「〜が観測される」「〜の傾向がある」）
- voice: 人格自身の言葉・信念（断定・比喩を許容。この人格が語るならこう言うだろう、という表現）

【出力フォーマット】
{
  "clusterId": number,
  "name": "クラスタの人格名（例：構造化実践エンジン）",
  "oneLiner": "一言での説明",
  "persona": {
    "identity": {
      "observation": "観測者視点での本質的な人格の記述",
      "voice": "人格自身の言葉（例：『構成は感情の地図だ』）"
    },
    "thinkingStyle": "思考スタイルの特徴",
    "motivation": "何に強く反応するか",
    "strength": "強み",
    "risk": "リスクや弱点",
    "roleInGrowth": "成長における役割",
    "currentState": {
      "trend": "rising/falling/flat",
      "driftContribution": number,
      "cohesion": number
    },
    "future": "未来予測"
  }
}`;
