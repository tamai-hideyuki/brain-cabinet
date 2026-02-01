import { db } from "../db/client";
import { mindmapNodes } from "../db/schema";
import type { MindmapNode, NewMindmapNode } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

type NodeType = "topic" | "question" | "decision_point" | "reference";

/**
 * 文字起こしセグメントからマインドマップノードを生成
 * 判断の地図: topic / question / decision_point / reference
 */
export async function processSegment(
  sessionId: string,
  segmentId: string,
  text: string
): Promise<{ node: MindmapNode | null; type: NodeType | null }> {
  const type = classifyNodeType(text);
  if (!type) return { node: null, type: null };

  const label = extractLabel(text, type);
  const parentId = await findParentNode(sessionId, type);

  const node: NewMindmapNode = {
    id: uuidv4(),
    sessionId,
    label,
    parentId,
    type,
    segmentId,
    createdAt: Date.now(),
  };

  await db.insert(mindmapNodes).values(node);
  return { node: node as MindmapNode, type };
}

/**
 * テキストからノードタイプを分類（ルールベース）
 * nullを返す場合はノード生成しない（ノイズ除去）
 */
function classifyNodeType(text: string): NodeType | null {
  const trimmed = text.trim();

  // 極端に短いセグメントは無視（相槌等）
  if (trimmed.length < 3) return null;

  // 疑問形 → question
  if (/\?|？|ですか|でしょうか|どう|なぜ|いかが|かな|だろう|よね/.test(trimmed)) return "question";

  // 判断を迫る表現 → decision_point
  if (/決め|選|判断|方針|どちらに|採用|却下|承認|進め方|すべき|した方|していく|やっていく|必要/.test(trimmed)) return "decision_point";

  // 参照・引用 → reference
  if (/参考|資料|データ|根拠|実績|前回|以前|例えば|たとえば|具体的/.test(trimmed)) return "reference";

  // 8文字以上あれば topic として追加
  if (trimmed.length >= 8) return "topic";

  return null;
}

/**
 * テキストからラベルを抽出（荒いまま）
 */
function extractLabel(text: string, type: NodeType): string {
  // 最大30文字、荒くて良い
  const maxLen = 30;
  let label = text.trim();
  if (label.length > maxLen) {
    label = label.slice(0, maxLen) + "…";
  }
  return label;
}

/**
 * 親ノードを探す
 * - question/decision_point → 直近のtopicの下に
 * - reference → 直近のquestionまたはdecision_pointの下に
 * - topic → ルート
 */
async function findParentNode(
  sessionId: string,
  type: NodeType
): Promise<string | null> {
  if (type === "topic") return null;

  let parentTypes: string[];
  if (type === "question" || type === "decision_point") {
    parentTypes = ["topic"];
  } else {
    // reference
    parentTypes = ["question", "decision_point", "topic"];
  }

  // 直近のマッチするノードを親とする
  const nodes = await db
    .select()
    .from(mindmapNodes)
    .where(eq(mindmapNodes.sessionId, sessionId))
    .orderBy(mindmapNodes.createdAt);

  for (let i = nodes.length - 1; i >= 0; i--) {
    if (parentTypes.includes(nodes[i].type)) {
      return nodes[i].id;
    }
  }

  return null;
}
