/**
 * Few-shot 学習用の例を取得する
 *
 * ユーザーが承認した推論結果から、各タイプごとに良い例を取得し、
 * プロンプトに含めることで推論精度を向上させる
 */

import { db } from "../../../db/client";
import { notes, llmInferenceResults } from "../../../db/schema";
import { eq, and, gte, desc, inArray } from "drizzle-orm";
import type { NoteType } from "../../../db/schema";
import { logger } from "../../../utils/logger";

// ============================================================
// 設定
// ============================================================

/** 各タイプから取得する例の最大数 */
const MAX_EXAMPLES_PER_TYPE = 2;

/** Few-shotに採用する最小confidence */
const MIN_CONFIDENCE_FOR_FEWSHOT = 0.85;

/** 例として使用するコンテンツの最大長 */
const MAX_CONTENT_LENGTH = 200;

/** 有効なノートタイプ */
const NOTE_TYPES: NoteType[] = ["decision", "learning", "scratch", "emotion", "log"];

// ============================================================
// 型定義
// ============================================================

export type FewShotExample = {
  type: NoteType;
  title: string;
  content: string;
  reasoning: string;
};

// ============================================================
// Few-shot例取得
// ============================================================

/**
 * ユーザーが承認した結果からFew-shot用の例を取得
 *
 * 条件:
 * - status = "approved" または "auto_applied"（高信頼度で自動適用されたもの）
 * - confidence >= MIN_CONFIDENCE_FOR_FEWSHOT
 * - 各タイプから最新 MAX_EXAMPLES_PER_TYPE 件
 */
export async function getFewShotExamples(): Promise<FewShotExample[]> {
  const examples: FewShotExample[] = [];

  try {
    for (const noteType of NOTE_TYPES) {
      // 承認済み or 高信頼度自動適用のものから取得
      const results = await db
        .select({
          noteId: llmInferenceResults.noteId,
          type: llmInferenceResults.type,
          confidence: llmInferenceResults.confidence,
          reasoning: llmInferenceResults.reasoning,
          resolvedAt: llmInferenceResults.resolvedAt,
        })
        .from(llmInferenceResults)
        .where(
          and(
            eq(llmInferenceResults.type, noteType),
            gte(llmInferenceResults.confidence, MIN_CONFIDENCE_FOR_FEWSHOT),
            // approved（明示的承認）または auto_applied（高信頼度自動適用）
            inArray(llmInferenceResults.status, ["approved", "auto_applied"])
          )
        )
        .orderBy(desc(llmInferenceResults.resolvedAt))
        .limit(MAX_EXAMPLES_PER_TYPE);

      // ノート情報を取得
      for (const result of results) {
        const noteData = await db
          .select({
            title: notes.title,
            content: notes.content,
          })
          .from(notes)
          .where(eq(notes.id, result.noteId))
          .limit(1);

        if (noteData.length > 0) {
          const content = noteData[0].content;
          // コンテンツを適切な長さに切り詰め
          const truncatedContent = content.length > MAX_CONTENT_LENGTH
            ? content.slice(0, MAX_CONTENT_LENGTH) + "..."
            : content;

          examples.push({
            type: result.type as NoteType,
            title: noteData[0].title,
            content: truncatedContent,
            reasoning: result.reasoning ?? "",
          });
        }
      }
    }

    logger.debug({ exampleCount: examples.length }, "Fetched few-shot examples");
    return examples;
  } catch (error) {
    logger.warn({ error }, "Failed to fetch few-shot examples, proceeding without them");
    return [];
  }
}

/**
 * Few-shot例をプロンプト用のテキストに変換
 */
export function formatFewShotExamples(examples: FewShotExample[]): string {
  if (examples.length === 0) {
    return "";
  }

  const formatted = examples.map((ex, i) => {
    return `### 例${i + 1}（${ex.type}）
タイトル: ${ex.title}
本文: ${ex.content}
→ 分類: ${ex.type}
理由: ${ex.reasoning}`;
  }).join("\n\n");

  return `## 分類の参考例（ユーザー承認済み）

以下はこのユーザーが過去に承認した分類例です。このユーザーの分類傾向を参考にしてください。

${formatted}

---

`;
}

/**
 * Few-shot例を取得してフォーマット済みテキストを返す
 * キャッシュ機能付き（同一リクエスト内での重複取得を防ぐ）
 */
let cachedExamples: { examples: FewShotExample[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60000; // 1分

export async function getFewShotPromptSection(): Promise<string> {
  const now = Date.now();

  // キャッシュが有効なら使用
  if (cachedExamples && (now - cachedExamples.fetchedAt) < CACHE_TTL) {
    return formatFewShotExamples(cachedExamples.examples);
  }

  // 新規取得
  const examples = await getFewShotExamples();
  cachedExamples = { examples, fetchedAt: now };

  return formatFewShotExamples(examples);
}

/**
 * キャッシュをクリア（テスト用/承認後の即時反映用）
 */
export function clearFewShotCache(): void {
  cachedExamples = null;
}
