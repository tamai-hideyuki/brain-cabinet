/**
 * Counterevidence Service
 *
 * v4.4 反証ログ機能の中核
 * - 判断の「反証」を記録し、失敗を資産化する
 * - decision.context に表示する反証情報を取得
 */

import { db } from "../../db/client";
import {
  decisionCounterevidences,
  notes,
  noteInferences,
  COUNTEREVIDENCE_TYPES,
  COUNTEREVIDENCE_SEVERITIES,
  type CounterevidencelType,
  type CounterevidencelSeverity,
} from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getLatestInference } from "../inference";

// -------------------------------------
// 型定義
// -------------------------------------

export type AddCounterevidencelInput = {
  decisionNoteId: string;
  type: CounterevidencelType;
  content: string;
  sourceNoteId?: string;
  severity?: CounterevidencelSeverity;
};

export type CounterevidencelItem = {
  id: number;
  type: CounterevidencelType;
  content: string;
  sourceNoteId?: string;
  severityScore: number;
  severityLabel: CounterevidencelSeverity;
  createdAt: number;
};

export type CounterevidencelSummary = {
  total: number;
  critical: number;
  major: number;
  minor: number;
  lastUpdatedAt: number | null;
  dominantType: CounterevidencelType | null;
};

// -------------------------------------
// ヘルパー
// -------------------------------------

/**
 * severityLabel から severityScore を計算
 */
function labelToScore(label: CounterevidencelSeverity): number {
  switch (label) {
    case "critical":
      return 0.9;
    case "major":
      return 0.6;
    case "minor":
    default:
      return 0.3;
  }
}

/**
 * ノートが decision タイプかどうかを検証
 */
async function validateDecisionNote(noteId: string): Promise<void> {
  const noteRows = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  if (noteRows.length === 0) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const inference = await getLatestInference(noteId);
  if (!inference || inference.type !== "decision") {
    throw new Error(`Note is not a decision: ${noteId}`);
  }
}

// -------------------------------------
// 反証を追加
// -------------------------------------

export async function addCounterevidence(
  input: AddCounterevidencelInput
): Promise<{ id: number }> {
  // 入力検証
  if (!COUNTEREVIDENCE_TYPES.includes(input.type)) {
    throw new Error(`Invalid counterevidence type: ${input.type}`);
  }

  const severityLabel = input.severity ?? "minor";
  if (!COUNTEREVIDENCE_SEVERITIES.includes(severityLabel)) {
    throw new Error(`Invalid severity: ${severityLabel}`);
  }

  // 対象ノートが decision であることを確認
  await validateDecisionNote(input.decisionNoteId);

  // sourceNoteId が指定されている場合、存在確認
  if (input.sourceNoteId) {
    const sourceRows = await db
      .select()
      .from(notes)
      .where(eq(notes.id, input.sourceNoteId))
      .limit(1);
    if (sourceRows.length === 0) {
      throw new Error(`Source note not found: ${input.sourceNoteId}`);
    }
  }

  const severityScore = labelToScore(severityLabel);

  const result = await db
    .insert(decisionCounterevidences)
    .values({
      decisionNoteId: input.decisionNoteId,
      type: input.type,
      content: input.content,
      sourceNoteId: input.sourceNoteId,
      severityScore,
      severityLabel,
    })
    .returning({ id: decisionCounterevidences.id });

  return { id: result[0].id };
}

// -------------------------------------
// 反証を取得
// -------------------------------------

export async function getCounterevidences(
  decisionNoteId: string
): Promise<CounterevidencelItem[]> {
  const rows = await db
    .select()
    .from(decisionCounterevidences)
    .where(eq(decisionCounterevidences.decisionNoteId, decisionNoteId))
    .orderBy(desc(decisionCounterevidences.createdAt));

  return rows.map((row) => ({
    id: row.id,
    type: row.type as CounterevidencelType,
    content: row.content,
    sourceNoteId: row.sourceNoteId ?? undefined,
    severityScore: row.severityScore,
    severityLabel: row.severityLabel as CounterevidencelSeverity,
    createdAt: row.createdAt,
  }));
}

// -------------------------------------
// 反証サマリーを取得
// -------------------------------------

export async function getCounterevidencelSummary(
  decisionNoteId: string
): Promise<CounterevidencelSummary> {
  const rows = await db
    .select()
    .from(decisionCounterevidences)
    .where(eq(decisionCounterevidences.decisionNoteId, decisionNoteId))
    .orderBy(desc(decisionCounterevidences.createdAt));

  if (rows.length === 0) {
    return {
      total: 0,
      critical: 0,
      major: 0,
      minor: 0,
      lastUpdatedAt: null,
      dominantType: null,
    };
  }

  // 深刻度別カウント
  let critical = 0;
  let major = 0;
  let minor = 0;
  const typeCounts = new Map<CounterevidencelType, number>();

  for (const row of rows) {
    switch (row.severityLabel) {
      case "critical":
        critical++;
        break;
      case "major":
        major++;
        break;
      default:
        minor++;
    }

    const type = row.type as CounterevidencelType;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  // 最も多いタイプを特定
  let dominantType: CounterevidencelType | null = null;
  let maxCount = 0;
  for (const [type, count] of typeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantType = type;
    }
  }

  return {
    total: rows.length,
    critical,
    major,
    minor,
    lastUpdatedAt: rows[0].createdAt,
    dominantType,
  };
}

// -------------------------------------
// 反証を削除
// -------------------------------------

export async function deleteCounterevidence(id: number): Promise<void> {
  await db
    .delete(decisionCounterevidences)
    .where(eq(decisionCounterevidences.id, id));
}
