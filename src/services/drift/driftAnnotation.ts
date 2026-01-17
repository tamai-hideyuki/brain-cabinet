/**
 * Drift Annotation Service (v7.3)
 *
 * ユーザーが日単位で主観ラベルを付与できる機能
 * - 自動計算されたphaseとユーザーの主観を比較可能に
 * - 思考の質的な変化を自己観測
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import {
  DRIFT_ANNOTATION_LABELS,
  type DriftAnnotationLabel,
} from "../../db/schema";
import type { DriftPhase } from "./driftService";

// ============================================================
// Types
// ============================================================

export type DriftAnnotation = {
  id: number;
  date: string;
  label: DriftAnnotationLabel;
  note: string | null;
  autoPhase: DriftPhase | null;
  createdAt: number;
  updatedAt: number;
};

export type CreateAnnotationInput = {
  date: string;
  label: DriftAnnotationLabel;
  note?: string;
  autoPhase?: DriftPhase;
};

export type UpdateAnnotationInput = {
  label?: DriftAnnotationLabel;
  note?: string;
};

// ============================================================
// Validation
// ============================================================

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

export function isValidLabel(label: string): label is DriftAnnotationLabel {
  return (DRIFT_ANNOTATION_LABELS as readonly string[]).includes(label);
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * アノテーションを作成または更新（upsert）
 */
export async function upsertAnnotation(
  input: CreateAnnotationInput
): Promise<DriftAnnotation> {
  if (!isValidDate(input.date)) {
    throw new Error(`Invalid date format: ${input.date}. Use YYYY-MM-DD.`);
  }

  if (!isValidLabel(input.label)) {
    throw new Error(
      `Invalid label: ${input.label}. Valid labels: ${DRIFT_ANNOTATION_LABELS.join(", ")}`
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // 既存のアノテーションを確認
  const existing = await getAnnotationByDate(input.date);

  if (existing) {
    // 更新
    await db.run(sql`
      UPDATE drift_annotations
      SET label = ${input.label},
          note = ${input.note ?? null},
          auto_phase = ${input.autoPhase ?? existing.autoPhase ?? null},
          updated_at = ${now}
      WHERE date = ${input.date}
    `);
  } else {
    // 新規作成
    await db.run(sql`
      INSERT INTO drift_annotations (date, label, note, auto_phase, created_at, updated_at)
      VALUES (${input.date}, ${input.label}, ${input.note ?? null}, ${input.autoPhase ?? null}, ${now}, ${now})
    `);
  }

  const result = await getAnnotationByDate(input.date);
  if (!result) {
    throw new Error("Failed to create/update annotation");
  }

  return result;
}

/**
 * 日付でアノテーションを取得
 */
export async function getAnnotationByDate(
  date: string
): Promise<DriftAnnotation | null> {
  const row = await db.get<{
    id: number;
    date: string;
    label: string;
    note: string | null;
    auto_phase: string | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT id, date, label, note, auto_phase, created_at, updated_at
    FROM drift_annotations
    WHERE date = ${date}
  `);

  if (!row) return null;

  return {
    id: row.id,
    date: row.date,
    label: row.label as DriftAnnotationLabel,
    note: row.note,
    autoPhase: row.auto_phase as DriftPhase | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * IDでアノテーションを取得
 */
export async function getAnnotationById(
  id: number
): Promise<DriftAnnotation | null> {
  const row = await db.get<{
    id: number;
    date: string;
    label: string;
    note: string | null;
    auto_phase: string | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT id, date, label, note, auto_phase, created_at, updated_at
    FROM drift_annotations
    WHERE id = ${id}
  `);

  if (!row) return null;

  return {
    id: row.id,
    date: row.date,
    label: row.label as DriftAnnotationLabel,
    note: row.note,
    autoPhase: row.auto_phase as DriftPhase | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 期間内のアノテーションを取得
 */
export async function getAnnotationsInRange(
  startDate: string,
  endDate: string
): Promise<DriftAnnotation[]> {
  const rows = await db.all<{
    id: number;
    date: string;
    label: string;
    note: string | null;
    auto_phase: string | null;
    created_at: number;
    updated_at: number;
  }>(sql`
    SELECT id, date, label, note, auto_phase, created_at, updated_at
    FROM drift_annotations
    WHERE date >= ${startDate} AND date <= ${endDate}
    ORDER BY date ASC
  `);

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    label: row.label as DriftAnnotationLabel,
    note: row.note,
    autoPhase: row.auto_phase as DriftPhase | null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * 最近のアノテーションを取得
 */
export async function getRecentAnnotations(
  days: number = 30
): Promise<DriftAnnotation[]> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return getAnnotationsInRange(startDate, endDate);
}

/**
 * アノテーションを削除
 */
export async function deleteAnnotation(id: number): Promise<boolean> {
  // 存在確認
  const existing = await getAnnotationById(id);
  if (!existing) return false;

  await db.run(sql`
    DELETE FROM drift_annotations
    WHERE id = ${id}
  `);

  return true;
}

/**
 * 日付でアノテーションを削除
 */
export async function deleteAnnotationByDate(date: string): Promise<boolean> {
  // 存在確認
  const existing = await getAnnotationByDate(date);
  if (!existing) return false;

  await db.run(sql`
    DELETE FROM drift_annotations
    WHERE date = ${date}
  `);

  return true;
}

// ============================================================
// Analytics
// ============================================================

/**
 * ラベルの統計を取得
 */
export async function getAnnotationStats(
  days: number = 90
): Promise<{
  total: number;
  byLabel: Record<DriftAnnotationLabel, number>;
  phaseMatch: { matched: number; mismatched: number; unknown: number };
}> {
  const annotations = await getRecentAnnotations(days);

  const byLabel: Record<DriftAnnotationLabel, number> = {
    breakthrough: 0,
    exploration: 0,
    deepening: 0,
    confusion: 0,
    rest: 0,
    routine: 0,
  };

  let matched = 0;
  let mismatched = 0;
  let unknown = 0;

  for (const ann of annotations) {
    byLabel[ann.label]++;

    if (!ann.autoPhase) {
      unknown++;
    } else {
      // ラベルとautoPhaseの一致を判定
      const isMatch = checkPhaseMatch(ann.label, ann.autoPhase);
      if (isMatch) {
        matched++;
      } else {
        mismatched++;
      }
    }
  }

  return {
    total: annotations.length,
    byLabel,
    phaseMatch: { matched, mismatched, unknown },
  };
}

/**
 * ユーザーラベルと自動phaseの一致を判定
 */
function checkPhaseMatch(label: DriftAnnotationLabel, autoPhase: DriftPhase): boolean {
  // ラベル → 期待されるphaseのマッピング
  const labelToExpectedPhase: Record<DriftAnnotationLabel, DriftPhase[]> = {
    breakthrough: ["creation"],
    exploration: ["creation", "neutral"],
    deepening: ["destruction", "neutral"],
    confusion: ["creation", "destruction"], // 混乱はどちらにもなりうる
    rest: ["neutral"],
    routine: ["neutral"],
  };

  const expectedPhases = labelToExpectedPhase[label];
  return expectedPhases.includes(autoPhase);
}

/**
 * アノテーションをMapとして取得（日付→アノテーション）
 */
export async function getAnnotationsAsMap(
  days: number = 90
): Promise<Map<string, DriftAnnotation>> {
  const annotations = await getRecentAnnotations(days);
  const map = new Map<string, DriftAnnotation>();

  for (const ann of annotations) {
    map.set(ann.date, ann);
  }

  return map;
}
